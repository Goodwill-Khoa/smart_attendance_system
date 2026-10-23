from datetime import date, datetime, timedelta, timezone
from typing import Iterable
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session as DbSession

import models

ATTENDANCE_GRACE_MINUTES = 15
MINIMUM_ATTENDANCE_MINUTES = 20


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def database_time(value: datetime) -> datetime:
    return as_utc(value).replace(tzinfo=None)


def schedule_bounds(schedule: models.ClassSchedule, class_date: date) -> tuple[datetime, datetime]:
    zone = ZoneInfo(schedule.timezone)
    start = datetime.combine(class_date, schedule.start_time, tzinfo=zone).astimezone(timezone.utc)
    end = datetime.combine(class_date, schedule.end_time, tzinfo=zone).astimezone(timezone.utc)
    return start, end


def occurrences_for(
    schedule: models.ClassSchedule,
    now: datetime,
    look_ahead_days: int = 0,
) -> list[tuple[datetime, datetime]]:
    local_date = as_utc(now).astimezone(ZoneInfo(schedule.timezone)).date()
    occurrences = []
    for offset in range(-1, look_ahead_days + 1):
        class_date = local_date + timedelta(days=offset)
        if class_date.weekday() == schedule.weekday:
            occurrences.append(schedule_bounds(schedule, class_date))
    return occurrences


def _roster_allows(
    db: DbSession,
    course_id: UUID,
    email: str,
    exempt_emails: set[str],
) -> bool:
    roster = db.query(models.CourseStudentRegistry).filter(
        models.CourseStudentRegistry.course_id == course_id
    ).all()
    if not roster:
        return True
    registered_emails = {(item.student_email or "").strip().lower() for item in roster}
    return email.strip().lower() in registered_emails or email.strip().lower() in exempt_emails


def _room_occupants(
    db: DbSession,
    room_name: str,
    at: datetime,
) -> list[tuple[models.RfidTapEvent, models.StudentCardCredential, models.User]]:
    rows = (
        db.query(models.RfidTapEvent, models.StudentCardCredential, models.User)
        .join(models.StudentCardCredential, models.RfidTapEvent.credential_id == models.StudentCardCredential.id)
        .join(models.User, models.StudentCardCredential.user_id == models.User.id)
        .join(models.RfidReader, models.RfidTapEvent.reader_id == models.RfidReader.id)
        .filter(
            models.RfidReader.room_name == room_name,
            models.StudentCardCredential.active == True,
            models.User.role == models.UserRole.STUDENT,
        )
        .all()
    )
    latest_by_credential = {}
    cutoff = as_utc(at)
    for event, credential, student in rows:
        event_time = as_utc(event.occurred_at)
        if event_time > cutoff:
            continue
        prior = latest_by_credential.get(credential.id)
        if prior is None or (event_time, str(event.id)) > (prior[0], str(prior[1].id)):
            latest_by_credential[credential.id] = (event_time, event, credential, student)

    return [
        (event, credential, student)
        for _, event, credential, student in latest_by_credential.values()
        if event.event_type == "ENTRY"
    ]


def _session_for_occurrence(
    db: DbSession,
    schedule: models.ClassSchedule,
    start: datetime,
    end: datetime,
    now: datetime,
) -> models.Session:
    stored_start = database_time(start)
    session = db.query(models.Session).filter(
        models.Session.schedule_id == schedule.id,
        models.Session.scheduled_start == stored_start,
    ).first()
    if session:
        return session

    course = db.query(models.Course).filter(models.Course.id == schedule.course_id).first()
    if not course:
        raise ValueError("A class schedule refers to a missing course")
    session = models.Session(
        course_id=course.id,
        lecturer_id=course.lecturer_id,
        schedule_id=schedule.id,
        scheduled_start=stored_start,
        scheduled_end=database_time(end),
        active=as_utc(now) < end,
        created_at=database_time(now),
        expires_at=database_time(end),
    )
    db.add(session)
    db.flush()
    return session


def _record_attendance(
    db: DbSession,
    session: models.Session,
    student: models.User,
    credential: models.StudentCardCredential,
    event: models.RfidTapEvent,
    status: str,
    source: str,
    recorded_at: datetime,
) -> models.AttendanceLog | None:
    existing = db.query(models.AttendanceLog).filter(
        models.AttendanceLog.session_id == session.id,
        models.AttendanceLog.user_id == student.id,
    ).first()
    if existing:
        return existing

    reader_id = event.reader_id
    log = models.AttendanceLog(
        session_id=session.id,
        user_id=student.id,
        device_id=f"reader:{reader_id}",
        qr_timestamp=database_time(recorded_at),
        timestamp=database_time(recorded_at),
        status=status,
        source=source,
    )
    db.add(log)
    db.flush()
    db.add(models.AttendanceEvent(
        session_id=session.id,
        user_id=student.id,
        credential_id=credential.id,
        reader_id=reader_id,
        event_type="ENTRY",
        source=source,
        occurred_at=database_time(recorded_at),
    ))
    return log


def _was_present_in_previous_slot(
    db: DbSession,
    schedule: models.ClassSchedule,
    start: datetime,
    student_id: UUID,
) -> bool:
    previous_session = (
        db.query(models.Session)
        .join(models.ClassSchedule, models.Session.schedule_id == models.ClassSchedule.id)
        .join(models.AttendanceLog, models.AttendanceLog.session_id == models.Session.id)
        .filter(
            models.ClassSchedule.room_name == schedule.room_name,
            models.Session.scheduled_end == database_time(start),
            models.AttendanceLog.user_id == student_id,
        )
        .first()
    )
    return previous_session is not None


def _materialize_occurrence(
    db: DbSession,
    schedule: models.ClassSchedule,
    start: datetime,
    end: datetime,
    now: datetime,
    exempt_emails: set[str],
) -> models.Session | None:
    snapshot_at = start + timedelta(minutes=ATTENDANCE_GRACE_MINUTES)
    now_utc = as_utc(now)
    if now_utc < start:
        return None

    session = _session_for_occurrence(db, schedule, start, end, now_utc)
    if now_utc >= snapshot_at:
        for event, credential, student in _room_occupants(db, schedule.room_name, snapshot_at):
            email = (student.email or "").strip().lower()
            if not _roster_allows(db, schedule.course_id, email, exempt_emails):
                continue
            event_time = as_utc(event.occurred_at)
            carryover = (
                event_time < start
                and _was_present_in_previous_slot(db, schedule, start, student.id)
            )
            attendance_time = start if carryover else event_time
            source = "CARRYOVER" if carryover else event.source
            _record_attendance(
                db,
                session,
                student,
                credential,
                event,
                "PRESENT",
                source,
                attendance_time,
            )

    if now_utc >= end:
        session.active = False
        for log in db.query(models.AttendanceLog).filter(
            models.AttendanceLog.session_id == session.id,
            models.AttendanceLog.checked_out_at.is_(None),
        ).all():
            log.checked_out_at = database_time(end)
            db.add(models.AttendanceEvent(
                session_id=session.id,
                user_id=log.user_id,
                event_type="EXIT",
                source="SCHEDULE_CLOSE",
                occurred_at=database_time(end),
            ))

    return session


def process_room(
    db: DbSession,
    room_name: str,
    now: datetime,
    exempt_emails: Iterable[str] = (),
) -> dict:
    schedules = db.query(models.ClassSchedule).filter(
        models.ClassSchedule.room_name == room_name,
        models.ClassSchedule.active == True,
    ).all()
    exempt = {email.strip().lower() for email in exempt_emails}
    occurrences = []
    for schedule in schedules:
        occurrences.extend(
            (schedule, start, end)
            for start, end in occurrences_for(schedule, now)
            if end + timedelta(hours=2) >= as_utc(now) and start <= as_utc(now)
        )

    sessions = []
    for schedule, start, end in occurrences:
        session = _materialize_occurrence(db, schedule, start, end, now, exempt)
        if session:
            sessions.append((schedule, start, end, session))
    db.commit()

    current = [
        item for item in sessions
        if item[1] <= as_utc(now) < item[2]
    ]
    if current:
        selected = min(current, key=lambda item: item[1])
    else:
        upcoming = []
        for schedule in schedules:
            upcoming.extend(
                (schedule, start, end, None)
                for start, end in occurrences_for(schedule, now, look_ahead_days=7)
                if start > as_utc(now) and start - as_utc(now) <= timedelta(hours=12)
            )
        selected = min(upcoming, key=lambda item: item[1]) if upcoming else None

    if not selected:
        return {
            "room_name": room_name,
            "session": None,
            "waiting": [],
            "present": [],
            "late": [],
            "left": [],
            "server_time": as_utc(now).isoformat(),
        }

    schedule, start, end, session = selected
    course = db.query(models.Course).filter(models.Course.id == schedule.course_id).first()
    snapshot_at = start + timedelta(minutes=ATTENDANCE_GRACE_MINUTES)
    waiting = []
    if as_utc(now) < snapshot_at:
        waiting = [
            {"name": student.name}
            for _, _, student in _room_occupants(db, room_name, now)
        ]

    present = []
    late = []
    left = []
    if session:
        attendance_rows = (
            db.query(models.AttendanceLog, models.User)
            .join(models.User, models.AttendanceLog.user_id == models.User.id)
            .filter(models.AttendanceLog.session_id == session.id)
            .order_by(models.AttendanceLog.timestamp.asc())
            .all()
        )
        for log, student in attendance_rows:
            item = {
                "name": student.name,
                "status": log.status,
                "entry_at": as_utc(log.timestamp).isoformat() if log.timestamp else None,
                "exit_at": as_utc(log.checked_out_at).isoformat() if log.checked_out_at else None,
            }
            if log.checked_out_at:
                left.append(item)
            elif log.status.startswith("LATE"):
                late.append(item)
            else:
                present.append(item)

    return {
        "room_name": room_name,
        "session": {
            "session_id": str(session.id) if session else None,
            "course_id": str(course.id) if course else None,
            "course_name": course.name if course else "",
            "starts_at": start.isoformat(),
            "ends_at": end.isoformat(),
            "snapshot_at": snapshot_at.isoformat(),
            "snapshot_complete": as_utc(now) >= snapshot_at,
            "active": as_utc(now) < end,
        },
        "waiting": waiting,
        "present": present,
        "late": late,
        "left": left,
        "server_time": as_utc(now).isoformat(),
    }


def record_room_tap(
    db: DbSession,
    reader: models.RfidReader,
    credential: models.StudentCardCredential,
    event_type: str,
    source: str,
    now: datetime,
    exempt_emails: Iterable[str] = (),
) -> dict:
    normalized_type = event_type.strip().upper()
    if normalized_type not in {"ENTRY", "EXIT"}:
        raise ValueError("event_type must be ENTRY or EXIT")
    if not reader.room_name:
        raise ValueError("Reader has no assigned room")

    db.query(models.RfidReader).filter(
        models.RfidReader.id == reader.id
    ).with_for_update().first()
    recent_events = (
        db.query(models.RfidTapEvent)
        .join(models.RfidReader, models.RfidTapEvent.reader_id == models.RfidReader.id)
        .filter(
            models.RfidReader.room_name == reader.room_name,
            models.RfidTapEvent.credential_id == credential.id,
        )
        .all()
    )
    latest = max(recent_events, key=lambda event: (as_utc(event.occurred_at), str(event.id)), default=None)
    currently_inside = bool(latest and latest.event_type == "ENTRY")
    if normalized_type == "ENTRY" and currently_inside:
        raise ValueError("Card is already checked in to this room")
    if normalized_type == "EXIT" and not currently_inside:
        raise ValueError("Card has no active entry in this room")

    event = models.RfidTapEvent(
        credential_id=credential.id,
        reader_id=reader.id,
        event_type=normalized_type,
        source=source,
        occurred_at=database_time(now),
    )
    db.add(event)
    db.flush()

    state = process_room(db, reader.room_name, now, exempt_emails)
    session_info = state.get("session")
    session = None
    if session_info and session_info.get("session_id"):
        session = db.query(models.Session).filter(
            models.Session.id == UUID(session_info["session_id"])
        ).first()

    student = db.query(models.User).filter(models.User.id == credential.user_id).first()
    if session and session.active:
        schedule = db.query(models.ClassSchedule).filter(
            models.ClassSchedule.id == session.schedule_id
        ).first()
        if schedule and normalized_type == "ENTRY":
            snapshot_at = as_utc(session.scheduled_start) + timedelta(minutes=ATTENDANCE_GRACE_MINUTES)
            if as_utc(now) >= snapshot_at:
                email = (student.email or "").strip().lower()
                if _roster_allows(db, schedule.course_id, email, {item.lower() for item in exempt_emails}):
                    existing = db.query(models.AttendanceLog).filter(
                        models.AttendanceLog.session_id == session.id,
                        models.AttendanceLog.user_id == student.id,
                    ).first()
                    if not existing:
                        _record_attendance(
                            db, session, student, credential, event,
                            "LATE", source, now,
                        )
        elif schedule and normalized_type == "EXIT":
            attendance = db.query(models.AttendanceLog).filter(
                models.AttendanceLog.session_id == session.id,
                models.AttendanceLog.user_id == student.id,
            ).first()
            if attendance and not attendance.checked_out_at:
                attendance.checked_out_at = database_time(now)
                minimum_end = as_utc(session.scheduled_start) + timedelta(minutes=MINIMUM_ATTENDANCE_MINUTES)
                if as_utc(now) < minimum_end:
                    attendance.status = "LATE_LEFT_EARLY" if attendance.status.startswith("LATE") else "LEFT_EARLY"
                db.add(models.AttendanceEvent(
                    session_id=session.id,
                    user_id=student.id,
                    credential_id=credential.id,
                    reader_id=reader.id,
                    event_type="EXIT",
                    source=source,
                    occurred_at=database_time(now),
                ))

    db.commit()
    return {
        "event_type": normalized_type,
        "student_name": student.name if student else "",
        "occurred_at": as_utc(now),
        "reader_state": process_room(db, reader.room_name, now, exempt_emails),
    }
