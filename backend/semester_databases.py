import json
import os
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import database
import models


def _read_registry() -> dict:
    path = database.SEMESTER_DATABASE_REGISTRY_PATH
    if not path.exists():
        return {"version": 1, "active_semester": None, "active_database": None, "databases": []}

    try:
        registry = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError("The semester database registry could not be read.") from error

    if registry.get("version") != 1 or not isinstance(registry.get("databases"), list):
        raise RuntimeError("The semester database registry has an unsupported format.")
    return registry


def _write_registry(registry: dict) -> None:
    path = database.SEMESTER_DATABASE_REGISTRY_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(".json.tmp")
    temporary_path.write_text(json.dumps(registry, indent=2), encoding="utf-8")
    os.replace(temporary_path, path)


def _semester_sort_key(label: str) -> tuple[int, int, str]:
    match = re.search(r"\b(20\d{2})\b", label)
    year = int(match.group(1)) if match else 0
    lowered = label.casefold()
    season_rank = 1 if "autumn" in lowered or "fall" in lowered else 0
    return year, season_rank, lowered


def _current_semester(db: Session, registry: dict) -> str | None:
    active = registry.get("active_semester")
    if isinstance(active, str) and active.strip():
        return active

    semesters = [
        semester
        for (semester,) in db.query(models.Course.semester).distinct().all()
        if semester and semester.strip()
    ]
    return max(semesters, key=_semester_sort_key) if semesters else None


def _course_identity(name: str, course_type: str) -> tuple[str, str]:
    normalized_name = " ".join(name.split()).casefold()
    normalized_type = " ".join(course_type.split()).casefold()
    return normalized_name, normalized_type


def course_identity_exists(db: Session, name: str, course_type: str, semester: str) -> bool:
    identity = _course_identity(name, course_type)
    courses = db.query(models.Course).filter(models.Course.semester == semester).all()
    return any(_course_identity(course.name, course.course_type) == identity for course in courses)


def _semester_slug(semester: str) -> str:
    ascii_label = unicodedata.normalize("NFKD", semester).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_label).strip("-").lower()
    return slug or str(uuid.uuid4())


def get_status(db: Session) -> dict:
    registry = _read_registry() if database.semester_database_supported() else {
        "active_semester": None,
        "databases": [],
    }
    active_semester = _current_semester(db, registry)
    active_path = database.active_database_path()
    active_sessions = db.query(models.Session).filter(models.Session.active.is_(True)).count()
    courses = []
    if active_semester:
        courses = [
            {
                "id": str(course.id),
                "name": course.name,
                "course_type": course.course_type,
                "code": course.code,
            }
            for course in db.query(models.Course)
            .filter(models.Course.semester == active_semester)
            .order_by(models.Course.name, models.Course.course_type, models.Course.code)
            .all()
        ]

    archived = [
        record["semester"]
        for record in registry["databases"]
        if record.get("status") == "archived" and record.get("semester")
    ]
    return {
        "supported": database.semester_database_supported(),
        "active_semester": active_semester,
        "active_database": active_path.name if active_path else None,
        "archived_semesters": archived,
        "active_session_count": active_sessions,
        "courses": courses,
    }


def _copy_records(target: Session, model, rows, overrides: dict | None = None) -> int:
    count = 0
    overrides = overrides or {}
    for row in rows:
        values = {column.name: getattr(row, column.name) for column in model.__table__.columns}
        values.update(overrides)
        target.add(model(**values))
        count += 1
    return count


def create_and_activate(db: Session, semester: str, course_ids: list[uuid.UUID]) -> dict:
    if not database.semester_database_supported():
        raise ValueError("Separate semester databases are available only for local file-based SQLite.")

    semester = semester.strip()
    if not semester:
        raise ValueError("Enter a semester name.")
    if not course_ids:
        raise ValueError("Select at least one course to carry into the new semester.")
    if len(set(course_ids)) != len(course_ids):
        raise ValueError("A course was selected more than once.")

    active_path = database.active_database_path()
    if active_path is None or not active_path.is_file():
        raise ValueError("The current SQLite database file could not be identified.")

    registry_path = database.SEMESTER_DATABASE_REGISTRY_PATH
    registry_before = registry_path.read_text(encoding="utf-8") if registry_path.exists() else None
    registry = _read_registry()
    current_semester = _current_semester(db, registry)
    if not current_semester:
        raise ValueError("The current database has no semester course catalog to carry forward.")
    if semester.casefold() == current_semester.casefold():
        raise ValueError("The new semester must have a different name from the active semester.")
    if any(record.get("semester", "").casefold() == semester.casefold() for record in registry["databases"]):
        raise ValueError("A database for this semester already exists.")

    active_session_count = db.query(models.Session).filter(models.Session.active.is_(True)).count()
    if active_session_count:
        raise ValueError("End all active class sessions before switching semester databases.")

    selected_courses = (
        db.query(models.Course)
        .filter(
            models.Course.id.in_(course_ids),
            models.Course.semester == current_semester,
        )
        .all()
    )
    if len(selected_courses) != len(course_ids):
        raise ValueError("One or more selected courses are not in the active semester.")

    seen_identities = set()
    for course in selected_courses:
        identity = _course_identity(course.name, course.course_type)
        if identity in seen_identities:
            raise ValueError(f"Duplicate course selected: {course.name} ({course.course_type}).")
        seen_identities.add(identity)

    target_path = database.SEMESTER_DATABASE_DIR / f"{_semester_slug(semester)}.sqlite3"
    if target_path.exists():
        raise ValueError("A database file with this semester name already exists; it will not be overwritten.")

    database.SEMESTER_DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    target_path.touch(exist_ok=False)
    target_engine = create_engine(f"sqlite:///{target_path.as_posix()}", pool_pre_ping=True)
    activated = False
    registry_written = False
    counts = {}

    try:
        models.Base.metadata.create_all(bind=target_engine)
        selected_course_set = set(course_ids)
        target = Session(target_engine)
        try:
            counts["users"] = _copy_records(target=target, model=models.User, rows=db.query(models.User).all())
            counts["lecturer_profiles"] = _copy_records(target=target, model=models.LecturerProfile, rows=db.query(models.LecturerProfile).all())
            counts["local_credentials"] = _copy_records(target=target, model=models.LocalCredential, rows=db.query(models.LocalCredential).all())
            counts["rfid_readers"] = _copy_records(target=target, model=models.RfidReader, rows=db.query(models.RfidReader).all())
            counts["student_card_credentials"] = _copy_records(target=target, model=models.StudentCardCredential, rows=db.query(models.StudentCardCredential).all())
            counts["courses"] = _copy_records(
                target=target,
                model=models.Course,
                rows=selected_courses,
                overrides={"semester": semester},
            )
            counts["teacher_course_assignments"] = _copy_records(
                target=target,
                model=models.TeacherCourseAssignment,
                rows=db.query(models.TeacherCourseAssignment)
                .filter(models.TeacherCourseAssignment.course_id.in_(selected_course_set))
                .all(),
            )
            counts["course_student_registry"] = _copy_records(
                target=target,
                model=models.CourseStudentRegistry,
                rows=db.query(models.CourseStudentRegistry)
                .filter(models.CourseStudentRegistry.course_id.in_(selected_course_set))
                .all(),
            )
            counts["class_schedules"] = _copy_records(
                target=target,
                model=models.ClassSchedule,
                rows=db.query(models.ClassSchedule)
                .filter(models.ClassSchedule.course_id.in_(selected_course_set))
                .all(),
            )
            target.commit()
        except Exception:
            target.rollback()
            raise
        finally:
            target.close()

        now = datetime.now(timezone.utc).isoformat()
        database_records = registry["databases"]
        if not database_records:
            database_records = [{
                "semester": current_semester,
                "database": str(active_path),
                "status": "active",
                "created_at": now,
            }]
        for record in database_records:
            record["status"] = "archived"
        database_records.append({
            "semester": semester,
            "database": str(target_path.resolve()),
            "status": "active",
            "created_at": now,
        })
        next_registry = {
            "version": 1,
            "active_semester": semester,
            "active_database": str(target_path.resolve()),
            "databases": database_records,
        }
        _write_registry(next_registry)
        registry_written = True
        target_engine.dispose()
        database.switch_to_sqlite_database(target_path)
        activated = True
    except Exception:
        if registry_written:
            if registry_before is None:
                registry_path.unlink(missing_ok=True)
            else:
                registry_path.write_text(registry_before, encoding="utf-8")
        target_engine.dispose()
        for cleanup_path in (target_path, Path(f"{target_path}-wal"), Path(f"{target_path}-shm")):
            cleanup_path.unlink(missing_ok=True)
        raise
    finally:
        if not activated:
            target_engine.dispose()

    return {
        "success": True,
        "active_semester": semester,
        "archived_semester": current_semester,
        "database": target_path.name,
        "copied": counts,
        "message": f"{semester} is now active. {current_semester} remains archived and unchanged.",
    }
