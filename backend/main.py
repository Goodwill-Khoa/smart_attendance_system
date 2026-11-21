from fastapi import FastAPI, Depends, HTTPException, Request, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
import models
import schemas
import rfid_scheduling
import database as database_module
import semester_databases
from authorization import auth, get_current_user
from database import engine, get_db
from models import UserRole
import uuid
import time
from datetime import datetime, timezone, timedelta
import hashlib
import hmac
import io, csv
from fastapi.responses import Response
import os
import re
import requests
import secrets
import string
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from openpyxl import load_workbook

models.Base.metadata.create_all(bind=engine)
optional_security = HTTPBearer(auto_error=False)
DEFAULT_LECTURER_PASSWORD = os.getenv("DEFAULT_LECTURER_PASSWORD", "qwe123")
DEFAULT_TEST_STUDENT_PASSWORD = os.getenv("DEFAULT_TEST_STUDENT_PASSWORD", "qwe123")
SUPERUSER_USERNAME = os.getenv("SUPERUSER_USERNAME", "superuser")
SUPERUSER_PASSWORD = os.getenv("SUPERUSER_PASSWORD", "admin123")
SUPERUSER_EMAIL = os.getenv("SUPERUSER_EMAIL", "superuser@inf.elte.hu")
SUPERUSER_DISPLAY_NAME = os.getenv("SUPERUSER_DISPLAY_NAME", "Superuser")
PROJECT_ROOT = Path(__file__).resolve().parents[1]
TEACHER_ROSTER_TEMPLATE_PATH = PROJECT_ROOT / "frontend" / "public" / "teacher_roster_template.csv"

def current_semester_label() -> str:
    now = datetime.now(timezone.utc)
    season = "Spring" if now.month <= 6 else "Autumn"
    return f"{season} {now.year}"

def ensure_schema_upgrades():
    inspector = inspect(engine)
    course_columns = {column["name"] for column in inspector.get_columns("courses")}
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    attendance_columns = {column["name"] for column in inspector.get_columns("attendance_logs")}
    session_columns = {column["name"] for column in inspector.get_columns("sessions")}
    reader_columns = {column["name"] for column in inspector.get_columns("rfid_readers")}
    if "semester" not in course_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE courses ADD COLUMN semester VARCHAR"))
            connection.execute(text("UPDATE courses SET semester = :semester WHERE semester IS NULL"), {"semester": current_semester_label()})
    if "course_type" not in course_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE courses ADD COLUMN course_type VARCHAR"))
            connection.execute(text("UPDATE courses SET course_type = 'L' WHERE course_type IS NULL"))
    if "is_admin" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"))
            connection.execute(text("UPDATE users SET is_admin = 0 WHERE is_admin IS NULL"))
    attendance_upgrades = []
    if "checked_out_at" not in attendance_columns:
        attendance_upgrades.append("ALTER TABLE attendance_logs ADD COLUMN checked_out_at TIMESTAMP")
    if "source" not in attendance_columns:
        attendance_upgrades.append("ALTER TABLE attendance_logs ADD COLUMN source VARCHAR NOT NULL DEFAULT 'QR'")
    if attendance_upgrades:
        with engine.begin() as connection:
            for statement in attendance_upgrades:
                connection.execute(text(statement))
    session_upgrades = []
    if "schedule_id" not in session_columns:
        session_upgrades.append("ALTER TABLE sessions ADD COLUMN schedule_id UUID")
    if "scheduled_start" not in session_columns:
        session_upgrades.append("ALTER TABLE sessions ADD COLUMN scheduled_start TIMESTAMP")
    if "scheduled_end" not in session_columns:
        session_upgrades.append("ALTER TABLE sessions ADD COLUMN scheduled_end TIMESTAMP")
    if session_upgrades:
        with engine.begin() as connection:
            for statement in session_upgrades:
                connection.execute(text(statement))
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_schedule_occurrence "
            "ON sessions (schedule_id, scheduled_start)"
        ))
    if "room_name" not in reader_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE rfid_readers ADD COLUMN room_name VARCHAR"))

DEFAULT_COURSES = [
    ("Advanced Software Technology", "L", ""),
    ("Design and analysis of algorithms", "L", "IPM-22fDAAE"),
    ("Design and analysis of algorithms", "Pr", "IPM-22fDAAG"),
    ("Formal semantics", "L", "IPM-22feszFSE"),
    ("Formal semantics", "Pr", "IPM-22feszFSG"),
    ("Software quality and testing", "L", "IPM-22feszSQTE"),
    ("Software quality and testing", "Pr", "IPM-22feszSQTE"),
    ("Software Technology", "Lab I", "IPM-22feszSALAB1"),
    ("Machine Learning", "L", "IPM-22feszMLEE"),
    ("Machine Learning", "Pr", "IPM-22feszMLEG"),
    ("Service Science", "L", "IPM-22feszSESCE"),
    ("Service Science", "Pr", "IPM-22feszSESCE"),
]

DEFAULT_LECTURERS = [
    ("Gergely Dévai", "deva@inf.elte.hu", "Course Management, Lectures, Material"),
    ("István Bátori", "istvan.batori@gmail.com", "Coaching"),
    ("Khawla Bouafia", "bouafia@inf.elte.hu", "Coaching"),
    ("Dániel Leskó", "ldani@elte.hu", "Coaching"),
    ("Attila Ulbert", "attila.ulbert@gmail.com", "Coaching"),
    ("Bálint Orosz", "balint.orosz@inf.elte.hu", "Coaching (Substitute for Attila Ulbert)"),
    ("Pál György Sarmasági", "psarmasagi@inf.elte.hu", "Coaching"),
    ("Zsolt Pelyhe", "zsoltipelyhe@gmail.com", "Lecturer"),
    ("Attila Bence Buzgan", "ba@inf.elte.hu", "Sample Lecturer"),
]

FALLBACK_TEACHER_ROSTER_ACCOUNTS = [
    ("gvq37g@inf.elte.hu", "Bouafia Khawla"),
    ("i8yvmx@inf.elte.hu", "Buzgán Attila Bence"),
    ("pc1w7y@inf.elte.hu", "Bátori István"),
    ("eun3j8@inf.elte.hu", "Dévai Gergely"),
    ("q1p3pw@inf.elte.hu", "Leskó Dániel"),
    ("bck909@inf.elte.hu", "Orosz Bálint Dominik"),
    ("a6f41u@inf.elte.hu", "Pelyhe Zsolt"),
    ("rep4jh@inf.elte.hu", "Pásztor-Nagy Anett"),
    ("fykiq8@inf.elte.hu", "Sarmasági Pál György"),
    ("sa3owu@inf.elte.hu", "Ulbert Attila Dr."),
]

MENTAL_ACCESS_STUDENTS = [
    ("student1@inf.elte.hu", "John Doe"),
    ("student2@inf.elte.hu", "Jane Smith"),
    ("student3@inf.elte.hu", "Alice Johnson"),
    ("student4@inf.elte.hu", "Bob Wilson"),
    ("student5@inf.elte.hu", "Carol Brown"),
    ("student6@inf.elte.hu", "David Miller"),
    ("student7@inf.elte.hu", "Emma Davis"),
    ("student8@inf.elte.hu", "Frank Taylor"),
    ("student9@inf.elte.hu", "Grace Anderson"),
    ("student10@inf.elte.hu", "Henry Thomas"),
    ("student11@inf.elte.hu", "Ivy Jackson"),
    ("student12@inf.elte.hu", "Jack Martin"),
    ("a9n7p5@inf.elte.hu", "Goodwill Khoa"),
    ("lyjzux@inf.elte.hu", "Maxim Curos"),
    ("lq38sf@inf.elte.hu", "Xuetao Li"),
    ("ctzr62@inf.elte.hu", "Yacine Naat"),
    ("fvmi7v@inf.elte.hu", "Kevin Zsombók"),
]
MENTAL_ACCESS_STUDENT_MAP = {
    email.lower(): name for email, name in MENTAL_ACCESS_STUDENTS
}


def get_mental_access_student_name(email: str) -> str | None:
    return MENTAL_ACCESS_STUDENT_MAP.get((email or "").strip().lower())


def is_mental_access_student(email: str) -> bool:
    return get_mental_access_student_name(email) is not None


def get_uploaded_course_student_roster_map(db: Session, course_id: uuid.UUID) -> dict[str, str]:
    return {
        item.student_email.lower(): (item.student_name or "").strip()
        for item in db.query(models.CourseStudentRegistry)
        .filter(models.CourseStudentRegistry.course_id == course_id)
        .all()
    }


def get_effective_course_student_roster_map(db: Session, course_id: uuid.UUID) -> dict[str, str]:
    roster_map = get_uploaded_course_student_roster_map(db, course_id)
    for email, name in MENTAL_ACCESS_STUDENT_MAP.items():
        if not roster_map.get(email):
            roster_map[email] = name
    return roster_map


def load_teacher_roster_template_accounts() -> list[tuple[str, str]]:
    if not TEACHER_ROSTER_TEMPLATE_PATH.exists():
        return FALLBACK_TEACHER_ROSTER_ACCOUNTS

    try:
        with TEACHER_ROSTER_TEMPLATE_PATH.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            accounts: dict[str, str] = {}
            for row in reader:
                email = (row.get("email") or "").strip().lower()
                name = (row.get("name") or "").strip()
                if not email or not name:
                    continue
                accounts[email] = name

            return list(accounts.items()) or FALLBACK_TEACHER_ROSTER_ACCOUNTS
    except OSError:
        return FALLBACK_TEACHER_ROSTER_ACCOUNTS


def get_teacher_roster_access_map() -> dict[str, str]:
    return {
        email.strip().lower(): full_name
        for email, full_name in load_teacher_roster_template_accounts()
    }


def is_teacher_roster_access_account(email: str) -> bool:
    return (email or "").strip().lower() in get_teacher_roster_access_map()

def normalized_code(name: str, course_type: str, raw_code: str, used_codes: set[str]) -> str:
    base = (raw_code or "").strip().rstrip(".")
    if not base:
        name_token = re.sub(r"[^A-Za-z0-9]+", "", name).upper()[:10] or "COURSE"
        type_token = re.sub(r"[^A-Za-z0-9]+", "", course_type).upper()[:4] or "TYPE"
        base = f"{name_token}-{type_token}"

    candidate = base
    suffix = 2
    while candidate in used_codes:
        type_token = re.sub(r"[^A-Za-z0-9]+", "", course_type).upper()[:4] or "TYPE"
        candidate = f"{base}-{type_token}-{suffix}"
        suffix += 1

    used_codes.add(candidate)
    return candidate

def seed_default_courses_if_empty():
    semester = current_semester_label()
    with Session(engine) as db:
        if db.query(models.Course.id).first():
            return

        used_codes = {course.code for course in db.query(models.Course).all()}
        existing_pairs = {
            (course.name, course.course_type, course.semester)
            for course in db.query(models.Course).all()
        }

        for name, course_type, raw_code in DEFAULT_COURSES:
            pair = (name, course_type, semester)
            if pair in existing_pairs:
                continue

            course = models.Course(
                id=uuid.uuid4(),
                name=name,
                course_type=course_type,
                code=normalized_code(name, course_type, raw_code, used_codes),
                semester=semester,
                lecturer_id=None,
            )
            db.add(course)
            existing_pairs.add(pair)

        db.commit()

def seed_default_lecturers():
    with Session(engine) as db:
        for full_name, raw_email, title in DEFAULT_LECTURERS:
            email = raw_email.strip().lower()

            user = db.query(models.User).filter(models.User.email == email).first()
            if not user:
                user = models.User(
                    id=uuid.uuid4(),
                    email=email,
                    name=full_name,
                    role=models.UserRole.TEACHER,
                )
                db.add(user)
            else:
                user.role = models.UserRole.TEACHER
                user.name = full_name

            profile = db.query(models.LecturerProfile).filter(models.LecturerProfile.email == email).first()
            now = datetime.now(timezone.utc)
            if not profile:
                profile = models.LecturerProfile(
                    id=uuid.uuid4(),
                    email=email,
                    title=title,
                    full_name=full_name,
                    must_change_password=False,
                    created_at=now,
                    updated_at=now,
                )
                db.add(profile)
            else:
                profile.title = title
                profile.full_name = full_name
                profile.updated_at = now

            ensure_local_credential(
                db,
                username=email,
                password=DEFAULT_LECTURER_PASSWORD,
                role="TEACHER",
                user_email=email,
            )

        db.commit()


def seed_teacher_roster_access_accounts():
    with Session(engine) as db:
        for email, full_name in load_teacher_roster_template_accounts():
            normalized_email = email.strip().lower()
            user = db.query(models.User).filter(models.User.email == normalized_email).first()
            if not user:
                user = models.User(
                    id=uuid.uuid4(),
                    email=normalized_email,
                    name=full_name,
                    role=models.UserRole.TEACHER,
                    is_admin=False,
                )
                db.add(user)
            else:
                user.name = full_name
                user.role = models.UserRole.TEACHER

            profile = db.query(models.LecturerProfile).filter(models.LecturerProfile.email == normalized_email).first()
            now = datetime.now(timezone.utc)
            if not profile:
                profile = models.LecturerProfile(
                    id=uuid.uuid4(),
                    email=normalized_email,
                    title="Lecturer",
                    full_name=full_name,
                    must_change_password=False,
                    created_at=now,
                    updated_at=now,
                )
                db.add(profile)
            else:
                profile.title = profile.title or "Lecturer"
                profile.full_name = full_name
                profile.must_change_password = False
                profile.updated_at = now

            ensure_local_credential(
                db,
                username=normalized_email,
                password=DEFAULT_LECTURER_PASSWORD,
                role="TEACHER",
                user_email=normalized_email,
            )

        db.commit()

def hash_local_password(password: str) -> str:
    # DB needs credential records; store hashes instead of plain text.
    digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return f"sha256${digest}"

def ensure_local_credential(
    db: Session,
    username: str,
    password: str,
    role: str,
    user_email: str | None,
    force_update: bool = False,
):
    now = datetime.now(timezone.utc)
    normalized_username = username.strip().lower()
    normalized_role = role.strip().upper()

    existing = (
        db.query(models.LocalCredential)
        .filter(
            models.LocalCredential.username == normalized_username,
            models.LocalCredential.role == normalized_role,
        )
        .first()
    )

    if existing:
        existing.user_email = user_email
        existing.active = True
        if force_update:
            existing.password_hash = hash_local_password(password)
        existing.updated_at = now
        return existing

    record = models.LocalCredential(
        id=uuid.uuid4(),
        username=normalized_username,
        password_hash=hash_local_password(password),
        role=normalized_role,
        user_email=user_email,
        active=True,
        created_at=now,
        updated_at=now,
    )
    db.add(record)
    return record

def seed_superuser_credential():
    with Session(engine) as db:
        ensure_local_credential(
            db,
            username=SUPERUSER_USERNAME,
            password=SUPERUSER_PASSWORD,
            role="SUPERUSER",
            user_email=None,
        )
        db.commit()


def seed_superuser_account():
    with Session(engine) as db:
        email = SUPERUSER_EMAIL.strip().lower()
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            user = models.User(
                id=uuid.uuid4(),
                email=email,
                name=SUPERUSER_DISPLAY_NAME,
                role=models.UserRole.TEACHER,
                is_admin=True,
            )
            db.add(user)
        else:
            user.name = SUPERUSER_DISPLAY_NAME
            user.role = models.UserRole.TEACHER
            user.is_admin = True

        profile = db.query(models.LecturerProfile).filter(models.LecturerProfile.email == email).first()
        now = datetime.now(timezone.utc)
        if not profile:
            profile = models.LecturerProfile(
                id=uuid.uuid4(),
                email=email,
                title="Superuser",
                full_name=SUPERUSER_DISPLAY_NAME,
                must_change_password=False,
                created_at=now,
                updated_at=now,
            )
            db.add(profile)
        else:
            profile.title = "Superuser"
            profile.full_name = SUPERUSER_DISPLAY_NAME
            profile.must_change_password = False
            profile.updated_at = now

        ensure_local_credential(
            db,
            username=email,
            password=SUPERUSER_PASSWORD,
            role="TEACHER",
            user_email=email,
        )
        ensure_local_credential(
            db,
            username=email,
            password=SUPERUSER_PASSWORD,
            role="SUPERUSER",
            user_email=email,
        )
        db.commit()


def seed_mental_access_students():
    with Session(engine) as db:
        for email, full_name in MENTAL_ACCESS_STUDENTS:
            normalized_email = email.strip().lower()
            user = db.query(models.User).filter(models.User.email == normalized_email).first()
            if not user:
                user = models.User(
                    id=uuid.uuid4(),
                    email=normalized_email,
                    name=full_name,
                    role=models.UserRole.STUDENT,
                    is_admin=False,
                )
                db.add(user)
            else:
                user.name = full_name
                user.role = models.UserRole.STUDENT

        db.commit()

ensure_schema_upgrades()
seed_default_courses_if_empty()
seed_default_lecturers()
seed_teacher_roster_access_accounts()
seed_superuser_credential()
seed_superuser_account()

SUPERUSER_KEY = os.getenv("SUPERUSER_KEY", "admin123")
TOKEN_WINDOW_SECONDS = 10
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
RFID_SIMULATOR_ENABLED = os.getenv("RFID_SIMULATOR_ENABLED", "false").strip().lower() == "true"
ATTENDANCE_TIMEZONE = os.getenv("ATTENDANCE_TIMEZONE", "Europe/Budapest")

def to_utc_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

def normalize_card_id(card_id: str) -> str:
    normalized = card_id.strip().upper()
    if not normalized or len(normalized) > 128 or not re.fullmatch(r"[A-Z0-9:_-]+", normalized):
        raise HTTPException(status_code=422, detail="Invalid RFID card identifier")
    return normalized

def hash_card_id(card_id: str) -> str:
    key = os.getenv("RFID_CREDENTIAL_HMAC_KEY", "")
    if len(key) < 32:
        raise HTTPException(
            status_code=503,
            detail="RFID_CREDENTIAL_HMAC_KEY must be configured with at least 32 characters",
        )
    return hmac.new(key.encode("utf-8"), normalize_card_id(card_id).encode("utf-8"), hashlib.sha256).hexdigest()

def get_simulator_now(db: Session) -> datetime:
    clock = db.query(models.RfidSimulatorClock).filter(models.RfidSimulatorClock.id == 1).first()
    if not clock:
        raise HTTPException(status_code=409, detail="Prepare the virtual schedule demo first")
    return to_utc_aware(clock.current_time)

def is_student_eligible_for_course(db: Session, course_id: uuid.UUID, email: str) -> bool:
    roster = get_uploaded_course_student_roster_map(db, course_id)
    return not roster or email.strip().lower() in roster or is_mental_access_student(email)

def require_rfid_simulator():
    if not RFID_SIMULATOR_ENABLED:
        raise HTTPException(status_code=404, detail="RFID simulator is disabled")

def record_rfid_event(
    db: Session,
    session_id: uuid.UUID,
    credential: models.StudentCardCredential,
    event_type: str,
    source: str,
    reader_id: uuid.UUID | None,
) -> dict:
    normalized_event_type = event_type.strip().upper()
    if normalized_event_type not in {"ENTRY", "EXIT"}:
        raise HTTPException(status_code=422, detail="event_type must be ENTRY or EXIT")

    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session.active:
        raise HTTPException(status_code=409, detail="Session is not active")
    if session.expires_at and to_utc_aware(session.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(status_code=409, detail="Session has expired")

    student = db.query(models.User).filter(models.User.id == credential.user_id).first()
    if not student or student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="RFID credential is not assigned to an active student")

    roster = get_uploaded_course_student_roster_map(db, session.course_id)
    student_email = (student.email or "").strip().lower()
    if roster and student_email not in roster and not is_mental_access_student(student_email):
        raise HTTPException(status_code=403, detail="Student is not registered in the course roster")

    attendance = (
        db.query(models.AttendanceLog)
        .filter(
            models.AttendanceLog.session_id == session.id,
            models.AttendanceLog.user_id == student.id,
        )
        .first()
    )
    if normalized_event_type == "ENTRY":
        if attendance:
            raise HTTPException(status_code=409, detail="Student has already checked in for this session")
    else:
        if not attendance:
            raise HTTPException(status_code=409, detail="Student must check in before checking out")
        if attendance.checked_out_at:
            raise HTTPException(status_code=409, detail="Student has already checked out for this session")

    occurred_at = datetime.now(timezone.utc)
    event = models.AttendanceEvent(
        session_id=session.id,
        user_id=student.id,
        credential_id=credential.id,
        reader_id=reader_id,
        event_type=normalized_event_type,
        source=source,
        occurred_at=occurred_at,
    )
    db.add(event)

    if normalized_event_type == "ENTRY":
        attendance = models.AttendanceLog(
            session_id=session.id,
            user_id=student.id,
            device_id=f"{source.lower()}:{reader_id or 'virtual'}",
            ip_address=None,
            qr_timestamp=occurred_at,
            timestamp=occurred_at,
            status="PRESENT",
            source=source,
        )
        db.add(attendance)
    else:
        attendance.checked_out_at = occurred_at

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This attendance event has already been recorded")

    return {
        "success": True,
        "message": f"{normalized_event_type.title()} recorded for {student.name}.",
        "event_type": normalized_event_type,
        "student_name": student.name,
        "occurred_at": occurred_at,
    }

def verify_admin(x_admin_key: str = Header(default="")):
    if x_admin_key != SUPERUSER_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin key")

def verify_admin_access(
    x_admin_key: str = Header(default=""),
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
    db: Session = Depends(get_db),
):
    if x_admin_key == SUPERUSER_KEY:
        return {"mode": "key", "email": None}

    if not credentials:
        raise HTTPException(status_code=401, detail="Admin authentication required")

    payload = auth.verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Authenticated user has no email")

    user_metadata = payload.get("user_metadata") or {}
    display_name = (
        user_metadata.get("name")
        or user_metadata.get("full_name")
        or email.split("@")[0]
    )

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(
            id=uuid.uuid4(),
            email=email,
            name=display_name,
            role=models.UserRole.TEACHER,
            is_admin=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.name:
        user.name = display_name
        db.commit()

    has_seeded_admin = db.query(models.User).filter(models.User.is_admin == True).first() is not None
    bootstrap_allowed = (not has_seeded_admin) and user.role == models.UserRole.TEACHER

    if not user.is_admin and not bootstrap_allowed:
        raise HTTPException(status_code=403, detail="Admin access denied")

    return {
        "mode": "token",
        "email": email,
        "isBootstrap": bootstrap_allowed,
        "isAdmin": bool(user.is_admin),
    }

def parse_uuid_or_400(value: str, field_name: str):
    try:
        return uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")

def get_latest_emergency_message(db: Session) -> str | None:
    latest = (
        db.query(models.EmergencyBroadcast)
        .filter(models.EmergencyBroadcast.active == True)
        .order_by(models.EmergencyBroadcast.created_at.desc())
        .first()
    )
    if not latest:
        return None
    return latest.message

def generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))

def _supabase_admin_headers() -> dict[str, str] | None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }

def _find_supabase_user_id_by_email(email: str) -> str | None:
    headers = _supabase_admin_headers()
    if not headers:
        return None

    try:
        res = requests.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers=headers,
            params={"page": 1, "per_page": 1000},
            timeout=10,
        )
        if not res.ok:
            return None

        payload = res.json()
        users = payload.get("users", []) if isinstance(payload, dict) else []
        for item in users:
            if (item.get("email") or "").lower() == email.lower():
                return item.get("id")
    except requests.RequestException:
        return None

    return None

def upsert_supabase_auth_user(
    email: str,
    password: str,
    user_metadata: dict[str, object] | None = None,
) -> tuple[bool, str]:
    headers = _supabase_admin_headers()
    if not headers:
        return False, "SUPABASE_SERVICE_ROLE_KEY is not configured."

    body = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": user_metadata or {},
    }

    try:
        create_res = requests.post(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            headers=headers,
            json=body,
            timeout=10,
        )
        if create_res.ok:
            return True, "Auth account provisioned."

        user_id = _find_supabase_user_id_by_email(email)
        if not user_id:
            return False, "Unable to provision Supabase auth user."

        update_res = requests.put(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers=headers,
            json={
                "password": password,
                "email_confirm": True,
                "user_metadata": user_metadata or {},
            },
            timeout=10,
        )
        if not update_res.ok:
            return False, "Unable to update Supabase auth account password."

        return True, "Auth account password refreshed."
    except requests.RequestException:
        return False, "Supabase auth provisioning request failed."


def ensure_supabase_auth_user(
    email: str,
    password: str,
    user_metadata: dict[str, object] | None = None,
) -> tuple[bool, str]:
    if not _supabase_admin_headers():
        return False, "SUPABASE_SERVICE_ROLE_KEY is not configured."

    if _find_supabase_user_id_by_email(email):
        return True, "Auth account already present."

    return upsert_supabase_auth_user(email=email, password=password, user_metadata=user_metadata)


def upsert_supabase_lecturer(email: str, full_name: str, title: str, password: str) -> tuple[bool, str]:
    return upsert_supabase_auth_user(
        email=email,
        password=password,
        user_metadata={
            "name": full_name,
            "title": title,
        },
    )


def upsert_supabase_student(email: str, full_name: str, password: str) -> tuple[bool, str]:
    return upsert_supabase_auth_user(
        email=email,
        password=password,
        user_metadata={
            "name": full_name,
            "mentalAccess": True,
        },
    )


def provision_mental_access_student_auth():
    if not _supabase_admin_headers():
        return

    for email, full_name in MENTAL_ACCESS_STUDENTS:
        upsert_supabase_student(email, full_name, DEFAULT_TEST_STUDENT_PASSWORD)


def provision_teacher_roster_auth():
    if not _supabase_admin_headers():
        return

    for email, full_name in load_teacher_roster_template_accounts():
        # Upsert (not just ensure) so stale existing auth users also get the expected default password.
        upsert_supabase_lecturer(
            email=email,
            full_name=full_name,
            title="Lecturer",
            password=DEFAULT_LECTURER_PASSWORD,
        )


def provision_superuser_auth():
    if not _supabase_admin_headers():
        return

    ensure_supabase_auth_user(
        email=SUPERUSER_EMAIL,
        password=SUPERUSER_PASSWORD,
        user_metadata={
            "name": SUPERUSER_DISPLAY_NAME,
            "title": "Superuser",
            "isAdmin": True,
        },
    )


seed_mental_access_students()
provision_mental_access_student_auth()
provision_teacher_roster_auth()
provision_superuser_auth()

def ensure_teacher_can_manage_course(db: Session, teacher_email: str, course_uuid: uuid.UUID):
    if is_teacher_roster_access_account(teacher_email):
        return

    assignment = (
        db.query(models.TeacherCourseAssignment)
        .filter(
            models.TeacherCourseAssignment.teacher_email == teacher_email,
            models.TeacherCourseAssignment.course_id == course_uuid,
        )
        .first()
    )
    if assignment:
        return

    course = db.query(models.Course).filter(models.Course.id == course_uuid).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Legacy fallback: allow management if lecturer_id points to the same teacher user.
    teacher_user = db.query(models.User).filter(models.User.email == teacher_email).first()
    if teacher_user and course.lecturer_id == teacher_user.id:
        return

    raise HTTPException(status_code=403, detail="You are not assigned to manage this course")


def _is_valid_roster_email(email: str) -> bool:
    # Testing-mode validation focuses on email presence/shape rather than specific domain allowlists.
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


def _finalize_roster_entries(entries: list[tuple[str, str]], invalid_rows: int) -> tuple[list[tuple[str, str]], int]:
    dedup: dict[str, str] = {}
    for email, name in entries:
        normalized_email = (email or "").strip().lower()
        normalized_name = (name or "").strip()

        if not normalized_email or not _is_valid_roster_email(normalized_email):
            invalid_rows += 1
            continue

        dedup[normalized_email] = normalized_name

    return [(email, dedup[email]) for email in dedup], invalid_rows


def parse_roster_csv(file_bytes: bytes) -> tuple[list[tuple[str, str]], int]:
    decoded = file_bytes.decode("utf-8-sig", errors="ignore")
    stream = io.StringIO(decoded)

    entries: list[tuple[str, str]] = []
    invalid_rows = 0

    first_line = stream.readline()
    stream.seek(0)
    has_header = "email" in first_line.lower()

    if has_header:
        reader = csv.DictReader(stream)
        for row in reader:
            email = (row.get("email") or row.get("student_email") or "").strip().lower()
            name = (row.get("name") or row.get("student_name") or "").strip()
            if not email:
                invalid_rows += 1
                continue
            entries.append((email, name))
    else:
        reader = csv.reader(stream)
        for row in reader:
            if not row:
                continue
            email = (row[0] or "").strip().lower()
            name = (row[1] if len(row) > 1 else "").strip()
            if not email:
                invalid_rows += 1
                continue
            entries.append((email, name))

    return _finalize_roster_entries(entries, invalid_rows)


def parse_roster_xlsx(file_bytes: bytes) -> tuple[list[tuple[str, str]], int]:
    invalid_rows = 0
    entries: list[tuple[str, str]] = []

    workbook = load_workbook(filename=io.BytesIO(file_bytes), read_only=True, data_only=True)
    sheet = workbook.active

    rows = sheet.iter_rows(values_only=True)
    first_row = next(rows, None)
    if first_row is None:
        return [], 0

    first_values = [str(item).strip() if item is not None else "" for item in first_row]
    lowered = [item.lower() for item in first_values]

    has_header = any("email" in item for item in lowered)

    def row_to_email_name(row_values: tuple) -> tuple[str, str]:
        email = (str(row_values[0]).strip().lower() if len(row_values) > 0 and row_values[0] is not None else "")
        name = (str(row_values[1]).strip() if len(row_values) > 1 and row_values[1] is not None else "")
        return email, name

    if has_header:
        email_index = next((idx for idx, item in enumerate(lowered) if item in {"email", "student_email"}), None)
        if email_index is None:
            return [], 1

        name_index = next((idx for idx, item in enumerate(lowered) if item in {"name", "student_name"}), None)

        for row in rows:
            if row is None:
                continue
            if not any(cell is not None and str(cell).strip() for cell in row):
                continue

            email = ""
            name = ""
            if email_index < len(row) and row[email_index] is not None:
                email = str(row[email_index]).strip().lower()
            if name_index is not None and name_index < len(row) and row[name_index] is not None:
                name = str(row[name_index]).strip()

            if not email:
                invalid_rows += 1
                continue
            entries.append((email, name))
    else:
        email, name = row_to_email_name(first_row)
        if email:
            entries.append((email, name))
        elif any(item is not None and str(item).strip() for item in first_row):
            invalid_rows += 1

        for row in rows:
            if row is None:
                continue
            if not any(cell is not None and str(cell).strip() for cell in row):
                continue

            email, name = row_to_email_name(row)
            if not email:
                invalid_rows += 1
                continue
            entries.append((email, name))

    return _finalize_roster_entries(entries, invalid_rows)


def parse_roster_file(file_bytes: bytes, filename: str | None) -> tuple[list[tuple[str, str]], int]:
    extension = Path(filename or "").suffix.lower()

    if extension == ".csv":
        return parse_roster_csv(file_bytes)
    if extension in {".xlsx", ".xlsm"}:
        return parse_roster_xlsx(file_bytes)

    raise HTTPException(status_code=400, detail="Unsupported roster file type. Use .csv or .xlsx")

app = FastAPI(title="Smart Multi-Modal Attendance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Smart Multi-Modal Attendance API is running!"}

@app.post("/auth/login", response_model=schemas.LoginResponse)
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    payload = auth.verify_token(request.providerToken)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    try:
        role = UserRole(request.role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role")

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Email missing in token")
    
    user = db.query(models.User).filter(models.User.email == email).first()

    if not user:
        user = models.User(
            email=email,
            name=payload.get("user_metadata", {}).get("name"),
            role=role
        )
        db.add(user)

    elif user.role != role:
        user.role = request.role

    db.commit()
    db.refresh(user)

    return {
        "userId": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role.value
    }

@app.post("/auth/session-sync", response_model=schemas.AuthSessionSyncResponse)
def auth_session_sync(
    request: schemas.AuthSessionSyncRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    email = (current_user.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Authenticated user email is missing")

    name = (current_user.get("name") or "").strip() or email.split("@")[0]
    mental_access_name = get_mental_access_student_name(email)

    try:
        requested_role = UserRole(request.role.strip().upper())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role. Use STUDENT or TEACHER.")

    if requested_role == UserRole.STUDENT and mental_access_name:
        name = mental_access_name

    user = db.query(models.User).filter(models.User.email == email).first()

    if not user:
        user = models.User(
            id=uuid.uuid4(),
            email=email,
            name=name,
            role=requested_role,
            is_admin=False,
        )
        db.add(user)
    else:
        user.name = name
        if requested_role == UserRole.TEACHER:
            user.role = UserRole.TEACHER
        elif user.role != UserRole.TEACHER:
            user.role = UserRole.STUDENT

    db.commit()
    db.refresh(user)

    return {
        "userId": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "isAdmin": bool(user.is_admin),
    }

@app.post("/sessions", response_model=schemas.SessionResponse)
def create_session(session_req: schemas.SessionCreate, db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == session_req.course_id).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    session = models.Session(
        id=uuid.uuid4(),
        course_id=session_req.course_id,
        lecturer_id=course.lecturer_id, 
        active=True,
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
    )

    # A new class session clears prior emergency protocol banner state.
    db.query(models.EmergencyBroadcast).filter(
        models.EmergencyBroadcast.active == True
    ).update({"active": False}, synchronize_session=False)

    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "sessionId": session.id,
        "isActive": session.active,
        "createdAt": session.created_at
    }

@app.get("/courses/teacher")
def get_teacher_courses(semester: str | None = None, teacherEmail: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Course)
    if semester:
        query = query.filter(models.Course.semester == semester)

    if teacherEmail:
        normalized_teacher_email = teacherEmail.strip().lower()
        if not is_teacher_roster_access_account(normalized_teacher_email):
            assigned_ids = {
                assignment.course_id
                for assignment in db.query(models.TeacherCourseAssignment)
                .filter(models.TeacherCourseAssignment.teacher_email == normalized_teacher_email)
                .all()
            }
            if assigned_ids:
                query = query.filter(models.Course.id.in_(assigned_ids))
            else:
                return []

    courses = query.order_by(models.Course.name.asc()).all()

    active_sessions = {
        str(session.course_id): str(session.id)
        for session in db.query(models.Session).filter(
            models.Session.active == True,
            models.Session.schedule_id.is_(None),
        ).all()
    }

    return [
        {
            "id": str(course.id),
            "name": course.name,
            "courseType": course.course_type,
            "code": course.code,
            "semester": course.semester,
            "activeSessionId": active_sessions.get(str(course.id))
        }
        for course in courses
    ]

@app.get("/courses/catalog")
def get_course_catalog(semester: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Course)
    if semester:
        query = query.filter(models.Course.semester == semester)

    courses = query.order_by(models.Course.name.asc()).all()

    return [
        {
            "id": str(course.id),
            "name": course.name,
            "courseType": course.course_type,
            "code": course.code,
            "semester": course.semester,
        }
        for course in courses
    ]

@app.post("/teacher/courses/assign")
def assign_course_to_teacher(req: schemas.TeacherCourseAssignRequest, db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == req.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = (
        db.query(models.TeacherCourseAssignment)
        .filter(
            models.TeacherCourseAssignment.teacher_email == req.teacher_email,
            models.TeacherCourseAssignment.course_id == req.course_id,
        )
        .first()
    )

    if existing:
        return {"success": True, "message": "Course already assigned."}

    assignment = models.TeacherCourseAssignment(
        id=uuid.uuid4(),
        teacher_email=req.teacher_email,
        course_id=req.course_id,
    )
    db.add(assignment)
    db.commit()

    return {"success": True, "message": "Course assigned to teacher."}

@app.delete("/teacher/courses/{courseId}/assign")
def unassign_course_from_teacher(courseId: str, teacherEmail: str, db: Session = Depends(get_db)):
    course_uuid = parse_uuid_or_400(courseId, "courseId")

    assignment = (
        db.query(models.TeacherCourseAssignment)
        .filter(
            models.TeacherCourseAssignment.teacher_email == teacherEmail,
            models.TeacherCourseAssignment.course_id == course_uuid,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    db.delete(assignment)
    db.commit()

    return {"success": True, "message": "Course removed from your list."}

@app.post("/courses/requests")
def create_course_request(req: schemas.CourseRequestCreate, db: Session = Depends(get_db)):
    new_request = models.CourseRequest(
        id=uuid.uuid4(),
        teacher_email=req.teacher_email,
        name=req.name.strip(),
        course_type=req.course_type.strip() or "L",
        code=(req.code or "").strip() or None,
        semester=req.semester.strip() or current_semester_label(),
        status="PENDING",
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    return {
        "id": str(new_request.id),
        "status": new_request.status,
        "message": "Request submitted for DB admin approval.",
    }

@app.get("/teacher/courses/{courseId}/students")
def get_course_student_registry(
    courseId: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    course_uuid = parse_uuid_or_400(courseId, "courseId")
    teacher_email = (current_user.get("email") or "").strip().lower()
    ensure_teacher_can_manage_course(db, teacher_email, course_uuid)

    roster_map = get_effective_course_student_roster_map(db, course_uuid)
    students = [
        {
            "email": email,
            "name": name or None,
        }
        for email, name in sorted(roster_map.items())
    ]

    return {
        "courseId": courseId,
        "count": len(students),
        "students": students,
    }

@app.post("/teacher/courses/{courseId}/students/upload", response_model=schemas.CourseRosterUploadSummary)
async def upload_course_student_registry(
    courseId: str,
    rosterFile: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    course_uuid = parse_uuid_or_400(courseId, "courseId")
    teacher_email = (current_user.get("email") or "").strip().lower()
    ensure_teacher_can_manage_course(db, teacher_email, course_uuid)

    file_bytes = await rosterFile.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded roster file is empty")

    parsed_entries, invalid_rows = parse_roster_file(file_bytes, rosterFile.filename)
    if not parsed_entries:
        raise HTTPException(status_code=400, detail="No valid student rows found in roster file")

    db.query(models.CourseStudentRegistry).filter(
        models.CourseStudentRegistry.course_id == course_uuid
    ).delete(synchronize_session=False)

    now = datetime.now(timezone.utc)
    for email, name in parsed_entries:
        db.add(
            models.CourseStudentRegistry(
                id=uuid.uuid4(),
                course_id=course_uuid,
                student_email=email,
                student_name=name or None,
                uploaded_by=teacher_email,
                created_at=now,
            )
        )

    db.commit()

    return {
        "courseId": courseId,
        "uploadedCount": len(parsed_entries),
        "invalidRows": invalid_rows,
        "message": "Student registry uploaded and activated for this course. Mental-access students remain validated by default.",
    }

@app.get("/semesters")
def get_semesters(db: Session = Depends(get_db)):
    semesters = sorted({
        course.semester for course in db.query(models.Course).all() if course.semester
    })

    if not semesters:
        semesters = [current_semester_label()]

    return {"semesters": semesters}

@app.get("/admin/semester-database")
def admin_semester_database(_: dict = Depends(verify_admin_access), db: Session = Depends(get_db)):
    return semester_databases.get_status(db)

@app.post("/admin/semester-database/activate")
def admin_activate_semester_database(
    req: schemas.SemesterDatabaseActivateRequest,
    _: dict = Depends(verify_admin_access),
    db: Session = Depends(get_db),
):
    if not database_module.semester_database_supported():
        raise HTTPException(
            status_code=409,
            detail="Semester database switching is available only for local file-based SQLite. Production PostgreSQL is unchanged.",
        )

    try:
        result = semester_databases.create_and_activate(db, req.semester, req.course_ids)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error

    global engine
    engine = database_module.engine
    return result

@app.post("/courses")
def create_course(course_req: schemas.CourseCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Course).filter(models.Course.code == course_req.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Course code already exists")

    course_name = course_req.name.strip()
    course_type = course_req.course_type.strip() or "L"
    semester = course_req.semester.strip() or current_semester_label()
    if semester_databases.course_identity_exists(db, course_name, course_type, semester):
        raise HTTPException(status_code=400, detail="Course already exists for this semester")

    new_course = models.Course(
        id=uuid.uuid4(),
        name=course_name,
        course_type=course_type,
        code=course_req.code.strip(),
        semester=semester,
        lecturer_id=None,
    )

    db.add(new_course)
    db.commit()
    db.refresh(new_course)

    return {
        "id": str(new_course.id),
        "name": new_course.name,
        "courseType": new_course.course_type,
        "code": new_course.code,
        "semester": new_course.semester,
    }

@app.delete("/courses/{courseId}")
def delete_course(courseId: str, db: Session = Depends(get_db)):
    course_uuid = parse_uuid_or_400(courseId, "courseId")
    course = db.query(models.Course).filter(models.Course.id == course_uuid).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    sessions = db.query(models.Session).filter(models.Session.course_id == course.id).all()
    session_ids = [session.id for session in sessions]

    if session_ids:
        db.query(models.AttendanceLog).filter(models.AttendanceLog.session_id.in_(session_ids)).delete(synchronize_session=False)
        db.query(models.Session).filter(models.Session.id.in_(session_ids)).delete(synchronize_session=False)

    db.query(models.TeacherCourseAssignment).filter(
        models.TeacherCourseAssignment.course_id == course_uuid
    ).delete(synchronize_session=False)

    db.delete(course)
    db.commit()

    return {"success": True, "message": "Course removed successfully."}

@app.get("/courses/student")
def get_student_courses(db: Session = Depends(get_db)):
    courses = db.query(models.Course).all()

    active_course_ids = {
        session.course_id
        for session in db.query(models.Session).filter(
            models.Session.active == True,
            models.Session.schedule_id.is_(None),
        ).all()
    }

    return [
        {
            "id": str(course.id),
            "name": course.name,
            "courseType": course.course_type,
            "code": course.code,
            "active": course.id in active_course_ids
        }
        for course in courses
    ]

@app.get("/sessions/active")
def get_active_session(courseId: str, db: Session = Depends(get_db)):
    try:
        course_uuid = uuid.UUID(courseId)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid courseId")

    session = (
        db.query(models.Session)
        .filter(
            models.Session.course_id == course_uuid,
            models.Session.active == True,
            models.Session.schedule_id.is_(None),
        )
        .order_by(models.Session.created_at.desc())
        .first()
    )

    if not session:
        return {
            "active": False,
            "sessionId": None
        }

    return {
        "active": True,
        "sessionId": str(session.id)
    }

@app.post("/sessions/{sessionId}/end")
def end_session(sessionId: str, db: Session = Depends(get_db)):
    session_uuid = parse_uuid_or_400(sessionId, "sessionId")
    session = db.query(models.Session).filter(models.Session.id == session_uuid).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.schedule_id:
        raise HTTPException(status_code=409, detail="Scheduled RFID sessions end automatically")

    if not session.active:
        return {
            "sessionId": str(session.id),
            "isActive": False,
            "message": "Session already ended."
        }

    session.active = False
    session.expires_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(session)

    return {
        "sessionId": str(session.id),
        "isActive": session.active,
        "message": "Session ended successfully."
    }

@app.get("/qr/{sessionId}")
def get_qr_token(sessionId: str, db: Session = Depends(get_db)):
    session_uuid = parse_uuid_or_400(sessionId, "sessionId")
    session = db.query(models.Session).filter(models.Session.id == session_uuid).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.schedule_id:
        raise HTTPException(status_code=409, detail="Scheduled classes use the room RFID reader")

    if not session.active:
        emergency_message = get_latest_emergency_message(db)
        if emergency_message:
            raise HTTPException(status_code=400, detail=f"Emergency protocol: {emergency_message}")
        raise HTTPException(status_code=400, detail="Session is not active")

    if session.expires_at and to_utc_aware(session.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Session expired")

    window = int(time.time()) // TOKEN_WINDOW_SECONDS

    raw = f"{sessionId}:{window}"
    token = hashlib.sha256(raw.encode()).hexdigest()

    return {
        "token": token,
        "expiresAt": datetime.now(timezone.utc).isoformat()
    }

@app.post("/admin/rfid/readers")
def create_rfid_reader(
    reader_req: schemas.RfidReaderCreate,
    _: dict = Depends(verify_admin_access),
    db: Session = Depends(get_db),
):
    name = reader_req.name.strip()
    room_name = reader_req.room_name.strip()
    if not name or not room_name:
        raise HTTPException(status_code=422, detail="Reader name and room are required")

    api_key = secrets.token_urlsafe(32)
    reader = models.RfidReader(
        name=name,
        room_name=room_name,
        key_hash=hashlib.sha256(api_key.encode("utf-8")).hexdigest(),
        active=True,
    )
    db.add(reader)
    db.commit()
    db.refresh(reader)
    return {"id": str(reader.id), "name": reader.name, "room_name": reader.room_name, "api_key": api_key}

@app.get("/admin/rfid/readers")
def list_rfid_readers(
    _: dict = Depends(verify_admin_access),
    db: Session = Depends(get_db),
):
    readers = db.query(models.RfidReader).filter(models.RfidReader.name != "Virtual Classroom Reader").all()
    return [
        {
            "id": str(reader.id),
            "name": reader.name,
            "room_name": reader.room_name,
            "active": reader.active,
            "created_at": reader.created_at,
        }
        for reader in readers
    ]

@app.get("/rfid/rooms")
def list_rfid_rooms(db: Session = Depends(get_db)):
    rows = db.query(models.RfidReader.room_name).filter(
        models.RfidReader.active == True,
        models.RfidReader.room_name.isnot(None),
    ).distinct().order_by(models.RfidReader.room_name.asc()).all()
    return [{"room_name": row[0]} for row in rows if row[0]]

@app.post("/admin/rfid/credentials")
def create_rfid_credential(
    credential_req: schemas.RfidCredentialCreate,
    _: dict = Depends(verify_admin_access),
    db: Session = Depends(get_db),
):
    email = credential_req.student_email.strip().lower()
    if not re.match(r"^[^@]+@[^@]+\.elte\.hu$", email):
        raise HTTPException(status_code=422, detail="Student email must be an ELTE address")

    credential_hash = hash_card_id(credential_req.card_id)
    if db.query(models.StudentCardCredential).filter(
        models.StudentCardCredential.credential_hash == credential_hash
    ).first():
        raise HTTPException(status_code=409, detail="This card is already registered")

    student = db.query(models.User).filter(models.User.email == email).first()
    if student and student.role != models.UserRole.STUDENT:
        raise HTTPException(status_code=409, detail="Email belongs to a non-student account")
    if not student:
        student = models.User(
            email=email,
            name=(credential_req.student_name or email.split("@")[0]).strip(),
            role=models.UserRole.STUDENT,
        )
        db.add(student)
        db.flush()

    active_card = db.query(models.StudentCardCredential).filter(
        models.StudentCardCredential.user_id == student.id,
        models.StudentCardCredential.active == True,
    ).first()
    if active_card:
        raise HTTPException(status_code=409, detail="Student already has an active card; revoke it before enrolling a replacement")

    credential = models.StudentCardCredential(
        user_id=student.id,
        credential_hash=credential_hash,
        active=True,
    )
    db.add(credential)
    db.commit()
    db.refresh(credential)
    return {
        "id": str(credential.id),
        "student_email": student.email,
        "active": credential.active,
        "created_at": credential.created_at,
    }

@app.get("/admin/rfid/credentials")
def list_rfid_credentials(
    _: dict = Depends(verify_admin_access),
    db: Session = Depends(get_db),
):
    records = (
        db.query(models.StudentCardCredential, models.User)
        .join(models.User, models.StudentCardCredential.user_id == models.User.id)
        .order_by(models.StudentCardCredential.created_at.desc())
        .all()
    )
    return [
        {
            "id": str(credential.id),
            "student_email": student.email,
            "student_name": student.name,
            "active": credential.active,
            "created_at": credential.created_at,
            "revoked_at": credential.revoked_at,
        }
        for credential, student in records
    ]

@app.post("/admin/rfid/credentials/{credential_id}/revoke")
def revoke_rfid_credential(
    credential_id: str,
    _: dict = Depends(verify_admin_access),
    db: Session = Depends(get_db),
):
    credential_uuid = parse_uuid_or_400(credential_id, "credential_id")
    credential = db.query(models.StudentCardCredential).filter(
        models.StudentCardCredential.id == credential_uuid
    ).first()
    if not credential:
        raise HTTPException(status_code=404, detail="RFID credential not found")
    if credential.active:
        credential.active = False
        credential.revoked_at = datetime.now(timezone.utc)
        db.commit()
    return {"success": True, "active": credential.active}

@app.get("/rfid/teacher/schedules")
def list_teacher_rfid_schedules(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher_email = (current_user.get("email") or "").strip().lower()
    if not teacher_email:
        raise HTTPException(status_code=401, detail="Authenticated teacher has no email")

    if is_teacher_roster_access_account(teacher_email):
        schedules = db.query(models.ClassSchedule).filter(
            models.ClassSchedule.active == True
        ).order_by(models.ClassSchedule.weekday, models.ClassSchedule.start_time).all()
    else:
        assigned_course_ids = {
            assignment.course_id
            for assignment in db.query(models.TeacherCourseAssignment)
            .filter(models.TeacherCourseAssignment.teacher_email == teacher_email)
            .all()
        }
        schedules = db.query(models.ClassSchedule).filter(
            models.ClassSchedule.course_id.in_(assigned_course_ids),
            models.ClassSchedule.active == True,
        ).order_by(models.ClassSchedule.weekday, models.ClassSchedule.start_time).all() if assigned_course_ids else []

    result = []
    for schedule in schedules:
        course = db.query(models.Course).filter(models.Course.id == schedule.course_id).first()
        result.append({
            "id": str(schedule.id),
            "course_id": str(schedule.course_id),
            "course_name": course.name if course else "",
            "course_code": course.code if course else "",
            "room_name": schedule.room_name,
            "weekday": schedule.weekday,
            "start_time": schedule.start_time.isoformat(timespec="minutes"),
            "end_time": schedule.end_time.isoformat(timespec="minutes"),
            "timezone": schedule.timezone,
            "schedule_source": schedule.schedule_source,
        })
    return result

@app.post("/rfid/teacher/schedules")
def create_teacher_rfid_schedule(
    schedule_req: schemas.ClassScheduleCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher_email = (current_user.get("email") or "").strip().lower()
    if not teacher_email:
        raise HTTPException(status_code=401, detail="Authenticated teacher has no email")
    if schedule_req.weekday < 0 or schedule_req.weekday > 6:
        raise HTTPException(status_code=422, detail="weekday must be between 0 (Monday) and 6 (Sunday)")
    if schedule_req.end_time <= schedule_req.start_time:
        raise HTTPException(status_code=422, detail="Class end time must be later than start time")
    duration_minutes = (
        schedule_req.end_time.hour * 60 + schedule_req.end_time.minute
        - schedule_req.start_time.hour * 60 - schedule_req.start_time.minute
    )
    if duration_minutes <= 20:
        raise HTTPException(status_code=422, detail="Scheduled classes must be longer than 20 minutes")
    try:
        ZoneInfo(schedule_req.timezone)
    except ZoneInfoNotFoundError:
        raise HTTPException(status_code=422, detail="Unknown IANA time zone")

    room_name = schedule_req.room_name.strip()
    room_reader = db.query(models.RfidReader).filter(
        models.RfidReader.room_name == room_name,
        models.RfidReader.active == True,
    ).first()
    if not room_reader:
        raise HTTPException(status_code=404, detail="No active RFID reader is assigned to this room")

    ensure_teacher_can_manage_course(db, teacher_email, schedule_req.course_id)
    overlap = db.query(models.ClassSchedule).filter(
        models.ClassSchedule.room_name == room_name,
        models.ClassSchedule.weekday == schedule_req.weekday,
        models.ClassSchedule.active == True,
        models.ClassSchedule.start_time < schedule_req.end_time,
        models.ClassSchedule.end_time > schedule_req.start_time,
    ).first()
    if overlap:
        raise HTTPException(status_code=409, detail="This room already has an overlapping class slot")

    schedule = models.ClassSchedule(
        course_id=schedule_req.course_id,
        room_name=room_name,
        weekday=schedule_req.weekday,
        start_time=schedule_req.start_time,
        end_time=schedule_req.end_time,
        timezone=schedule_req.timezone,
        schedule_source="LECTURER",
        created_by=teacher_email,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return {"id": str(schedule.id), "message": "RFID class schedule created"}

@app.delete("/rfid/teacher/schedules/{schedule_id}")
def delete_teacher_rfid_schedule(
    schedule_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher_email = (current_user.get("email") or "").strip().lower()
    schedule_uuid = parse_uuid_or_400(schedule_id, "schedule_id")
    schedule = db.query(models.ClassSchedule).filter(
        models.ClassSchedule.id == schedule_uuid,
        models.ClassSchedule.active == True,
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="RFID schedule not found")
    ensure_teacher_can_manage_course(db, teacher_email, schedule.course_id)
    schedule.active = False
    db.commit()
    return {"success": True, "message": "RFID class schedule disabled"}

def authenticate_rfid_reader(reader_id: str, reader_key: str, db: Session) -> models.RfidReader:
    reader_uuid = parse_uuid_or_400(reader_id, "reader_id")
    reader = db.query(models.RfidReader).filter(models.RfidReader.id == reader_uuid).first()
    if not reader or not reader.active:
        raise HTTPException(status_code=401, detail="Reader is not registered or active")
    supplied_hash = hashlib.sha256(reader_key.encode("utf-8")).hexdigest()
    if not hmac.compare_digest(reader.key_hash, supplied_hash):
        raise HTTPException(status_code=401, detail="Invalid reader key")
    return reader

def get_reader_time(reader: models.RfidReader, db: Session) -> datetime:
    if reader.name == "Virtual Classroom Reader" and RFID_SIMULATOR_ENABLED:
        return get_simulator_now(db)
    return datetime.now(timezone.utc)

@app.get("/rfid/reader/state")
def get_rfid_reader_state(
    x_reader_id: str = Header(default=""),
    x_reader_key: str = Header(default=""),
    db: Session = Depends(get_db),
):
    reader = authenticate_rfid_reader(x_reader_id, x_reader_key, db)
    if not reader.room_name:
        raise HTTPException(status_code=409, detail="Reader has no assigned room")
    return rfid_scheduling.process_room(
        db,
        reader.room_name,
        get_reader_time(reader, db),
        MENTAL_ACCESS_STUDENT_MAP.keys(),
    )

@app.post("/rfid/events", response_model=schemas.RfidEventResponse)
def submit_rfid_event(
    event_req: schemas.RfidEventRequest,
    x_reader_id: str = Header(default=""),
    x_reader_key: str = Header(default=""),
    db: Session = Depends(get_db),
):
    reader = authenticate_rfid_reader(x_reader_id, x_reader_key, db)

    credential = db.query(models.StudentCardCredential).filter(
        models.StudentCardCredential.credential_hash == hash_card_id(event_req.card_id)
    ).first()
    if not credential or not credential.active:
        raise HTTPException(status_code=403, detail="Unknown or revoked RFID card")
    if event_req.session_id:
        return record_rfid_event(
            db,
            event_req.session_id,
            credential,
            event_req.event_type,
            "RFID",
            reader.id,
        )
    if not reader.room_name:
        raise HTTPException(status_code=409, detail="Reader has no assigned room")
    try:
        tap = rfid_scheduling.record_room_tap(
            db, reader, credential, event_req.event_type, "RFID",
            get_reader_time(reader, db), MENTAL_ACCESS_STUDENT_MAP.keys(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return {
        "success": True,
        "message": f"{tap['event_type'].title()} recorded for {tap['student_name']}.",
        "event_type": tap["event_type"],
        "student_name": tap["student_name"],
        "occurred_at": tap["occurred_at"],
    }

@app.post("/rfid/simulator/setup")
def setup_rfid_simulator(db: Session = Depends(get_db)):
    require_rfid_simulator()
    hash_card_id("SIM-CARD-001")

    course = db.query(models.Course).filter(models.Course.code == "RFID-DEMO").first()
    if not course:
        course = models.Course(
            name="RFID Virtual Demo",
            course_type="Demo",
            code="RFID-DEMO",
            semester=current_semester_label(),
        )
        db.add(course)
        db.flush()

    for active_session in db.query(models.Session).filter(
        models.Session.course_id == course.id,
        models.Session.active == True,
    ).all():
        active_session.active = False
        active_session.expires_at = datetime.now(timezone.utc)

    demo_session = models.Session(course_id=course.id, active=True)
    db.add(demo_session)
    db.flush()

    demo_students = [
        ("rfid.demo.01@example.invalid", "Alex Demo", "SIM-CARD-001", True),
        ("rfid.demo.02@example.invalid", "Sam Demo", "SIM-CARD-002", True),
        ("rfid.demo.03@example.invalid", "Taylor Demo", "SIM-CARD-003", False),
    ]
    cards = []
    for email, name, card_id, should_be_active in demo_students:
        student = db.query(models.User).filter(models.User.email == email).first()
        if not student:
            student = models.User(email=email, name=name, role=models.UserRole.STUDENT)
            db.add(student)
            db.flush()
        registration = db.query(models.CourseStudentRegistry).filter(
            models.CourseStudentRegistry.course_id == course.id,
            models.CourseStudentRegistry.student_email == email,
        ).first()
        if not registration:
            db.add(models.CourseStudentRegistry(
                course_id=course.id,
                student_email=email,
                student_name=name,
                uploaded_by="RFID demo",
            ))

        credential_hash = hash_card_id(card_id)
        credential = db.query(models.StudentCardCredential).filter(
            models.StudentCardCredential.credential_hash == credential_hash
        ).first()
        if not credential:
            credential = models.StudentCardCredential(
                user_id=student.id,
                credential_hash=credential_hash,
                active=should_be_active,
                revoked_at=None if should_be_active else datetime.now(timezone.utc),
            )
            db.add(credential)
        elif not should_be_active and credential.active:
            credential.active = False
            credential.revoked_at = datetime.now(timezone.utc)

        cards.append({
            "card_id": card_id,
            "student_name": name,
            "active": should_be_active and credential.active,
        })

    virtual_reader = db.query(models.RfidReader).filter(
        models.RfidReader.name == "Virtual Classroom Reader"
    ).first()
    if not virtual_reader:
        virtual_reader = models.RfidReader(
            name="Virtual Classroom Reader",
            key_hash=hashlib.sha256(b"local-virtual-rfid-reader").hexdigest(),
            active=True,
        )
        db.add(virtual_reader)
    else:
        virtual_reader.active = True

    db.commit()
    return {
        "session_id": str(demo_session.id),
        "course_name": course.name,
        "reader_name": virtual_reader.name,
        "cards": cards,
    }

@app.post("/rfid/simulator/schedule-setup")
def setup_rfid_schedule_simulator(db: Session = Depends(get_db)):
    require_rfid_simulator()
    hash_card_id("SIM-CARD-001")
    try:
        zone = ZoneInfo(ATTENDANCE_TIMEZONE)
    except ZoneInfoNotFoundError:
        raise HTTPException(status_code=500, detail="ATTENDANCE_TIMEZONE is not a valid IANA time zone")

    local_now = datetime.now(zone)
    clock = db.query(models.RfidSimulatorClock).filter(models.RfidSimulatorClock.id == 1).first()
    simulation_date = local_now.date()
    if clock:
        previous_local = to_utc_aware(clock.current_time).astimezone(zone)
        simulation_date = previous_local.date() + timedelta(days=7)
    simulated_local_time = datetime.combine(
        simulation_date,
        datetime.strptime("07:55", "%H:%M").time(),
        tzinfo=zone,
    )
    simulated_now = simulated_local_time.astimezone(timezone.utc)

    course_specs = [
        ("RFID-DEMO", "RFID Virtual Demo"),
        ("RFID-DEMO-NEXT", "RFID Next Class Demo"),
    ]
    demo_courses = []
    for code, name in course_specs:
        course = db.query(models.Course).filter(models.Course.code == code).first()
        if not course:
            course = models.Course(
                name=name,
                course_type="Demo",
                code=code,
                semester=current_semester_label(),
            )
            db.add(course)
            db.flush()
        demo_courses.append(course)

    virtual_reader = db.query(models.RfidReader).filter(
        models.RfidReader.name == "Virtual Classroom Reader"
    ).first()
    if not virtual_reader:
        virtual_reader = models.RfidReader(
            name="Virtual Classroom Reader",
            room_name="Demo Lecture Hall",
            key_hash=hashlib.sha256(b"local-virtual-rfid-reader").hexdigest(),
            active=True,
        )
        db.add(virtual_reader)
        db.flush()
    else:
        virtual_reader.room_name = "Demo Lecture Hall"
        virtual_reader.active = True

    if clock:
        previous_simulated_now = get_simulator_now(db)
        latest_demo_events = {}
        prior_rows = (
            db.query(models.RfidTapEvent)
            .filter(models.RfidTapEvent.reader_id == virtual_reader.id)
            .all()
        )
        for prior_event in prior_rows:
            previous = latest_demo_events.get(prior_event.credential_id)
            if previous is None or (
                to_utc_aware(prior_event.occurred_at),
                str(prior_event.id),
            ) > (
                to_utc_aware(previous.occurred_at),
                str(previous.id),
            ):
                latest_demo_events[prior_event.credential_id] = prior_event
        for prior_event in latest_demo_events.values():
            if prior_event.event_type == "ENTRY":
                db.add(models.RfidTapEvent(
                    credential_id=prior_event.credential_id,
                    reader_id=virtual_reader.id,
                    event_type="EXIT",
                    source="SIMULATOR_RESET",
                    occurred_at=rfid_scheduling.database_time(previous_simulated_now),
                ))

    old_demo_sessions = db.query(models.Session).filter(
        models.Session.course_id.in_([course.id for course in demo_courses]),
        models.Session.active == True,
    ).all()
    for old_session in old_demo_sessions:
        old_session.active = False
        old_session.expires_at = rfid_scheduling.database_time(
            previous_simulated_now if clock else simulated_now
        )
        for attendance in db.query(models.AttendanceLog).filter(
            models.AttendanceLog.session_id == old_session.id,
            models.AttendanceLog.checked_out_at.is_(None),
        ).all():
            attendance.checked_out_at = rfid_scheduling.database_time(
                previous_simulated_now if clock else simulated_now
            )

    existing_schedules = db.query(models.ClassSchedule).filter(
        models.ClassSchedule.created_by == "RFID demo"
    ).order_by(models.ClassSchedule.start_time.asc()).all()
    slot_specs = [
        (demo_courses[0], datetime.strptime("08:00", "%H:%M").time(), datetime.strptime("09:00", "%H:%M").time()),
        (demo_courses[1], datetime.strptime("09:00", "%H:%M").time(), datetime.strptime("10:00", "%H:%M").time()),
    ]
    for index, (course, start_time, end_time) in enumerate(slot_specs):
        schedule = existing_schedules[index] if index < len(existing_schedules) else models.ClassSchedule()
        schedule.course_id = course.id
        schedule.room_name = virtual_reader.room_name
        schedule.weekday = simulation_date.weekday()
        schedule.start_time = start_time
        schedule.end_time = end_time
        schedule.timezone = ATTENDANCE_TIMEZONE
        schedule.schedule_source = "LECTURER"
        schedule.active = True
        schedule.created_by = "RFID demo"
        if index >= len(existing_schedules):
            db.add(schedule)
    for schedule in existing_schedules[len(slot_specs):]:
        schedule.active = False

    demo_students = [
        ("rfid.demo.01@example.invalid", "Alex Demo", "SIM-CARD-001", True),
        ("rfid.demo.02@example.invalid", "Sam Demo", "SIM-CARD-002", True),
        ("rfid.demo.03@example.invalid", "Taylor Demo", "SIM-CARD-003", False),
    ]
    cards = []
    for email, name, card_id, should_be_active in demo_students:
        student = db.query(models.User).filter(models.User.email == email).first()
        if not student:
            student = models.User(email=email, name=name, role=models.UserRole.STUDENT)
            db.add(student)
            db.flush()
        for course in demo_courses:
            registration = db.query(models.CourseStudentRegistry).filter(
                models.CourseStudentRegistry.course_id == course.id,
                models.CourseStudentRegistry.student_email == email,
            ).first()
            if not registration:
                db.add(models.CourseStudentRegistry(
                    course_id=course.id,
                    student_email=email,
                    student_name=name,
                    uploaded_by="RFID demo",
                ))

        credential_hash = hash_card_id(card_id)
        credential = db.query(models.StudentCardCredential).filter(
            models.StudentCardCredential.credential_hash == credential_hash
        ).first()
        if not credential:
            credential = models.StudentCardCredential(
                user_id=student.id,
                credential_hash=credential_hash,
                active=should_be_active,
                revoked_at=None if should_be_active else datetime.now(timezone.utc),
            )
            db.add(credential)
        elif not should_be_active and credential.active:
            credential.active = False
            credential.revoked_at = datetime.now(timezone.utc)
        cards.append({
            "card_id": card_id,
            "student_name": name,
            "active": bool(should_be_active and credential.active),
        })

    if not clock:
        clock = models.RfidSimulatorClock(id=1, current_time=rfid_scheduling.database_time(simulated_now))
        db.add(clock)
    else:
        clock.current_time = rfid_scheduling.database_time(simulated_now)

    db.commit()
    state = rfid_scheduling.process_room(
        db,
        virtual_reader.room_name,
        simulated_now,
        MENTAL_ACCESS_STUDENT_MAP.keys(),
    )
    return {
        "room_name": virtual_reader.room_name,
        "current_time": simulated_now.isoformat(),
        "cards": cards,
        "reader_state": state,
    }

@app.get("/rfid/simulator/state")
def get_rfid_simulator_state(db: Session = Depends(get_db)):
    require_rfid_simulator()
    reader = db.query(models.RfidReader).filter(
        models.RfidReader.name == "Virtual Classroom Reader",
        models.RfidReader.active == True,
    ).first()
    if not reader:
        raise HTTPException(status_code=409, detail="Prepare the virtual schedule demo first")
    state = rfid_scheduling.process_room(
        db,
        reader.room_name,
        get_simulator_now(db),
        MENTAL_ACCESS_STUDENT_MAP.keys(),
    )
    return {"current_time": get_simulator_now(db).isoformat(), "reader_state": state}

@app.post("/rfid/simulator/advance-time")
def advance_rfid_simulator_time(
    clock_req: schemas.RfidSimulatorClockAdvance,
    db: Session = Depends(get_db),
):
    require_rfid_simulator()
    if clock_req.minutes < 1 or clock_req.minutes > 720:
        raise HTTPException(status_code=422, detail="Advance minutes must be between 1 and 720")
    clock = db.query(models.RfidSimulatorClock).filter(models.RfidSimulatorClock.id == 1).first()
    if not clock:
        raise HTTPException(status_code=409, detail="Prepare the virtual schedule demo first")
    new_time = to_utc_aware(clock.current_time) + timedelta(minutes=clock_req.minutes)
    clock.current_time = rfid_scheduling.database_time(new_time)
    db.commit()
    reader = db.query(models.RfidReader).filter(
        models.RfidReader.name == "Virtual Classroom Reader",
        models.RfidReader.active == True,
    ).first()
    state = rfid_scheduling.process_room(
        db,
        reader.room_name,
        new_time,
        MENTAL_ACCESS_STUDENT_MAP.keys(),
    )
    return {"current_time": new_time.isoformat(), "reader_state": state}

@app.post("/rfid/simulator/tap", response_model=schemas.RfidEventResponse)
def simulate_rfid_tap(
    tap_req: schemas.RfidSimulatorTapRequest,
    db: Session = Depends(get_db),
):
    require_rfid_simulator()
    credential = db.query(models.StudentCardCredential).filter(
        models.StudentCardCredential.credential_hash == hash_card_id(tap_req.card_id)
    ).first()
    if not credential or not credential.active:
        raise HTTPException(status_code=403, detail="Unknown or revoked RFID card")
    reader = db.query(models.RfidReader).filter(
        models.RfidReader.name == "Virtual Classroom Reader",
        models.RfidReader.active == True,
    ).first()
    if not reader:
        raise HTTPException(status_code=409, detail="Prepare the virtual RFID reader first")
    if not tap_req.session_id:
        try:
            tap = rfid_scheduling.record_room_tap(
                db,
                reader,
                credential,
                tap_req.event_type,
                "SIMULATED",
                get_simulator_now(db),
                MENTAL_ACCESS_STUDENT_MAP.keys(),
            )
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc))
        return {
            "success": True,
            "message": f"{tap['event_type'].title()} recorded for {tap['student_name']}.",
            "event_type": tap["event_type"],
            "student_name": tap["student_name"],
            "occurred_at": tap["occurred_at"],
        }
    return record_rfid_event(
        db,
        tap_req.session_id,
        credential,
        tap_req.event_type,
        "SIMULATED",
        reader.id,
    )

@app.post("/rfid/simulator/end-session")
def end_rfid_simulator_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    require_rfid_simulator()
    demo_course = db.query(models.Course).filter(models.Course.code == "RFID-DEMO").first()
    session = db.query(models.Session).filter(
        models.Session.id == session_id,
        models.Session.course_id == (demo_course.id if demo_course else None),
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Virtual demo session not found")
    session.active = False
    session.expires_at = datetime.now(timezone.utc)
    db.commit()
    return {"success": True, "message": "Virtual demo session ended"}

@app.post("/attendance", response_model=schemas.ScanResponse)
def submit_scan(
    scan_req: schemas.ScanRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    client_ip = request.client.host

    student_email = (current_user.get("email") or "").strip().lower()
    if not re.match(r"^[^@]+@[^@]+\.elte\.hu$", student_email):
        raise HTTPException(
            status_code=403,
            detail="Student login must use ELTE Microsoft SSO email (*.elte.hu).",
        )

    student_name = get_mental_access_student_name(student_email) or (current_user.get("name") or "").strip() or student_email.split("@")[0]

    student = db.query(models.User).filter(models.User.email == student_email).first()
    if not student:
        student = models.User(
            id=uuid.uuid4(),
            email=student_email,
            name=student_name,
            role=models.UserRole.STUDENT,
        )
        db.add(student)
        db.flush()
    elif student.role != models.UserRole.STUDENT:
        student.role = models.UserRole.STUDENT

    # Name comes from Microsoft SSO for now; registration-list validation can be layered later.
    student.name = student_name

    sessions = db.query(models.Session).filter(models.Session.active == True).all()

    if not sessions:
        emergency_message = get_latest_emergency_message(db)
        if emergency_message:
            raise HTTPException(status_code=404, detail=f"Emergency protocol: {emergency_message}")
        raise HTTPException(status_code=404, detail="No active sessions")

    current_window = int(time.time()) // TOKEN_WINDOW_SECONDS

    valid_session = None

    for session in sessions:
        raw = f"{session.id}:{current_window}"
        expected_token = hashlib.sha256(raw.encode()).hexdigest()

        prev_raw = f"{session.id}:{current_window - 1}"
        prev_token = hashlib.sha256(prev_raw.encode()).hexdigest()

        if scan_req.token in [expected_token, prev_token]:
            valid_session = session
            break

    if not valid_session:
        raise HTTPException(status_code=401, detail="Invalid or expired QR token")

    if valid_session.schedule_id:
        raise HTTPException(status_code=409, detail="Scheduled classes use the room RFID reader")

    uploaded_roster_map = get_uploaded_course_student_roster_map(db, valid_session.course_id)

    if uploaded_roster_map:
        if student_email not in uploaded_roster_map and not is_mental_access_student(student_email):
            raise HTTPException(
                status_code=403,
                detail="Student is not registered in the uploaded course roster.",
            )

        uploaded_name = (uploaded_roster_map.get(student_email) or "").strip()
        if uploaded_name:
            student.name = uploaded_name
    elif is_mental_access_student(student_email):
        student.name = get_mental_access_student_name(student_email) or student.name

    existing = db.query(models.AttendanceLog).filter(
        models.AttendanceLog.session_id == valid_session.id,
        models.AttendanceLog.user_id == student.id
    ).first()

    if existing:
        raise HTTPException(status_code=409, detail="Student has already checked in for this session")

    recorded_at = datetime.now(timezone.utc)
    log = models.AttendanceLog(
        session_id=valid_session.id,
        user_id=student.id,
        device_id=scan_req.deviceToken,
        ip_address=client_ip,
        qr_timestamp=recorded_at,
        timestamp=recorded_at,
        status="PRESENT",
        source="QR",
    )
    event = models.AttendanceEvent(
        session_id=valid_session.id,
        user_id=student.id,
        event_type="ENTRY",
        source="QR",
        occurred_at=recorded_at,
    )
    db.add(log)
    db.add(event)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Student has already checked in for this session")
    db.refresh(log)

    return {
        "success": True,
        "message": "Attendance recorded successfully."
    }

@app.get("/sessions/{sessionId}/export")
def export_attendance(sessionId: str, db: Session = Depends(get_db)):
    session_uuid = parse_uuid_or_400(sessionId, "sessionId")
    session = db.query(models.Session).filter(models.Session.id == session_uuid).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # LEFT JOIN (IMPORTANT FIX)
    rows = (
        db.query(models.AttendanceLog, models.User)
        .outerjoin(models.User, models.AttendanceLog.user_id == models.User.id)
        .filter(models.AttendanceLog.session_id == session_uuid)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)

    # headers = separate columns
    writer.writerow([
        "User ID",
        "User name",
        "Attendance source",
        "Device ID",
        "IP Address",
        "Entry timestamp",
        "Exit timestamp",
        "Status"
    ])

    for log, user in rows:
        user_id_value = ""
        if user and user.email:
            user_id_value = user.email.split("@")[0]

        writer.writerow([
            user_id_value,
            user.name if user else "",
            log.source,
            log.device_id,
            log.ip_address,
            log.timestamp,
            log.checked_out_at,
            log.status
        ])

    output.seek(0)

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=attendance_{sessionId}.csv"
        }
    )

@app.get("/admin/overview", response_model=schemas.AdminOverview)
def admin_overview(_: dict = Depends(verify_admin_access), db: Session = Depends(get_db)):
    return {
        "users": db.query(models.User).count(),
        "courses": db.query(models.Course).count(),
        "activeSessions": db.query(models.Session).filter(models.Session.active == True).count(),
        "totalSessions": db.query(models.Session).count(),
        "attendanceLogs": db.query(models.AttendanceLog).count(),
    }

@app.get("/admin/sessions/active")
def admin_active_sessions(_: dict = Depends(verify_admin_access), db: Session = Depends(get_db)):
    sessions = (
        db.query(models.Session, models.Course)
        .join(models.Course, models.Session.course_id == models.Course.id)
        .filter(models.Session.active == True)
        .order_by(models.Session.created_at.desc())
        .all()
    )

    return [
        {
            "sessionId": str(session.id),
            "courseId": str(course.id),
            "courseName": course.name,
            "courseCode": course.code,
            "semester": course.semester,
            "startedAt": session.created_at,
        }
        for session, course in sessions
    ]

@app.post("/admin/sessions/end-all")
def admin_end_all_sessions(req: schemas.AdminEndAllSessionsRequest, _: dict = Depends(verify_admin_access), db: Session = Depends(get_db)):
    comment = req.comment.strip()
    if not comment:
        raise HTTPException(status_code=400, detail="Comment is required for emergency protocol.")

    now = datetime.now(timezone.utc)
    active_sessions = db.query(models.Session).filter(models.Session.active == True).all()

    ended_count = 0
    for session in active_sessions:
        session.active = False
        session.expires_at = now
        ended_count += 1

    db.query(models.EmergencyBroadcast).filter(
        models.EmergencyBroadcast.active == True
    ).update({"active": False}, synchronize_session=False)

    db.add(
        models.EmergencyBroadcast(
            id=uuid.uuid4(),
            message=comment,
            active=True,
            created_at=now,
        )
    )

    db.commit()

    return {
        "success": True,
        "endedSessions": ended_count,
        "message": "Emergency protocol executed. All active sessions ended.",
        "comment": comment,
    }

@app.get("/system/emergency-message")
def get_emergency_message(db: Session = Depends(get_db)):
    message = get_latest_emergency_message(db)
    return {
        "active": bool(message),
        "message": message,
    }

@app.get("/admin/course-requests")
def admin_course_requests(_: dict = Depends(verify_admin_access), db: Session = Depends(get_db)):
    requests = (
        db.query(models.CourseRequest)
        .order_by(models.CourseRequest.created_at.desc())
        .all()
    )

    return [
        {
            "id": str(item.id),
            "teacherEmail": item.teacher_email,
            "name": item.name,
            "courseType": item.course_type,
            "code": item.code,
            "semester": item.semester,
            "status": item.status,
            "createdAt": item.created_at,
            "reviewedAt": item.reviewed_at,
            "reviewerNote": item.reviewer_note,
        }
        for item in requests
    ]

@app.get("/admin/lecturers")
def admin_list_lecturers(_: dict = Depends(verify_admin_access), db: Session = Depends(get_db)):
    profiles_by_email = {
        item.email.lower(): item
        for item in db.query(models.LecturerProfile).all()
    }

    lecturers = (
        db.query(models.User)
        .filter(models.User.role == models.UserRole.TEACHER)
        .order_by(models.User.created_at.desc())
        .all()
    )

    return [
        {
            "id": str(item.id),
            "email": item.email,
            "name": item.name,
            "title": (profiles_by_email.get(item.email.lower()).title if profiles_by_email.get(item.email.lower()) else "Lecturer"),
            "fullName": (profiles_by_email.get(item.email.lower()).full_name if profiles_by_email.get(item.email.lower()) else item.name),
            "mustChangePassword": bool(profiles_by_email.get(item.email.lower()).must_change_password) if profiles_by_email.get(item.email.lower()) else False,
            "role": item.role.value,
            "isAdmin": bool(item.is_admin),
            "createdAt": item.created_at,
        }
        for item in lecturers
    ]

@app.post("/admin/lecturers")
def admin_create_lecturer(req: schemas.AdminLecturerCreateRequest, _: dict = Depends(verify_admin_access), db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    title = req.title.strip() or "Lecturer"
    full_name = req.full_name.strip()
    is_admin = bool(req.is_admin)

    if not email:
        raise HTTPException(status_code=400, detail="Lecturer email is required.")
    if not full_name:
        raise HTTPException(status_code=400, detail="Lecturer full name is required.")

    temp_password = generate_temp_password()
    auth_ok, auth_message = upsert_supabase_lecturer(email, full_name, title, temp_password)

    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        if existing.role != models.UserRole.TEACHER:
            existing.role = models.UserRole.TEACHER
        existing.name = full_name
        existing.is_admin = is_admin
        lecturer = existing
    else:
        lecturer = models.User(
            id=uuid.uuid4(),
            email=email,
            name=full_name,
            role=models.UserRole.TEACHER,
            is_admin=is_admin,
        )
        db.add(lecturer)

    profile = db.query(models.LecturerProfile).filter(models.LecturerProfile.email == email).first()
    now = datetime.now(timezone.utc)
    if not profile:
        profile = models.LecturerProfile(
            id=uuid.uuid4(),
            email=email,
            title=title,
            full_name=full_name,
            must_change_password=True,
            created_at=now,
            updated_at=now,
        )
        db.add(profile)
    else:
        profile.title = title
        profile.full_name = full_name
        profile.must_change_password = True
        profile.updated_at = now

    ensure_local_credential(
        db,
        username=email,
        password=temp_password,
        role="TEACHER",
        user_email=email,
        force_update=True,
    )

    if is_admin:
        ensure_local_credential(
            db,
            username=email,
            password=temp_password,
            role="SUPERUSER",
            user_email=email,
            force_update=True,
        )

    db.commit()
    db.refresh(lecturer)

    return {
        "id": str(lecturer.id),
        "email": lecturer.email,
        "name": lecturer.name,
        "title": title,
        "fullName": full_name,
        "tempPassword": temp_password,
        "authProvisioned": auth_ok,
        "authMessage": auth_message,
        "role": lecturer.role.value,
        "isAdmin": bool(lecturer.is_admin),
        "message": "Lecturer added. Send temporary password to lecturer email and require password change at first login.",
    }

@app.get("/admin/auth/check")
def admin_auth_check(admin_context: dict = Depends(verify_admin_access)):
    return {
        "success": True,
        "mode": admin_context.get("mode"),
        "email": admin_context.get("email"),
        "isBootstrap": bool(admin_context.get("isBootstrap")),
        "isAdmin": bool(admin_context.get("isAdmin")),
    }

@app.post("/admin/lecturers/{lecturerId}/admin-access")
def admin_set_lecturer_admin_access(
    lecturerId: str,
    req: schemas.AdminUserAccessUpdate,
    _: dict = Depends(verify_admin_access),
    db: Session = Depends(get_db),
):
    lecturer_uuid = parse_uuid_or_400(lecturerId, "lecturerId")
    lecturer = db.query(models.User).filter(models.User.id == lecturer_uuid).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")
    if lecturer.role != models.UserRole.TEACHER:
        raise HTTPException(status_code=400, detail="Only lecturers can receive admin access")

    lecturer.is_admin = bool(req.is_admin)

    teacher_cred = (
        db.query(models.LocalCredential)
        .filter(
            models.LocalCredential.username == lecturer.email.lower(),
            models.LocalCredential.role == "TEACHER",
        )
        .first()
    )
    if teacher_cred:
        ensure_local_credential(
            db,
            username=lecturer.email.lower(),
            password="placeholder",
            role="SUPERUSER",
            user_email=lecturer.email.lower(),
        )
        super_cred = (
            db.query(models.LocalCredential)
            .filter(
                models.LocalCredential.username == lecturer.email.lower(),
                models.LocalCredential.role == "SUPERUSER",
            )
            .first()
        )
        if super_cred:
            super_cred.password_hash = teacher_cred.password_hash
            super_cred.active = bool(req.is_admin)
            super_cred.updated_at = datetime.now(timezone.utc)

    db.commit()
    return {
        "success": True,
        "message": "Admin access updated.",
        "id": str(lecturer.id),
        "isAdmin": bool(lecturer.is_admin),
    }

@app.delete("/admin/lecturers/{lecturerId}")
def admin_delete_lecturer(
    lecturerId: str,
    _: dict = Depends(verify_admin_access),
    db: Session = Depends(get_db),
):
    lecturer_uuid = parse_uuid_or_400(lecturerId, "lecturerId")
    lecturer = db.query(models.User).filter(models.User.id == lecturer_uuid).first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")
    if lecturer.role != models.UserRole.TEACHER:
        raise HTTPException(status_code=400, detail="Selected user is not a lecturer")

    lecturer_email = lecturer.email.strip().lower()

    db.query(models.Course).filter(models.Course.lecturer_id == lecturer.id).update(
        {models.Course.lecturer_id: None},
        synchronize_session=False,
    )
    db.query(models.Session).filter(models.Session.lecturer_id == lecturer.id).update(
        {models.Session.lecturer_id: None},
        synchronize_session=False,
    )
    db.query(models.TeacherCourseAssignment).filter(
        models.TeacherCourseAssignment.teacher_email == lecturer_email
    ).delete(synchronize_session=False)
    db.query(models.PasswordResetRequest).filter(
        models.PasswordResetRequest.lecturer_email == lecturer_email
    ).delete(synchronize_session=False)
    db.query(models.LocalCredential).filter(
        models.LocalCredential.user_email == lecturer_email
    ).delete(synchronize_session=False)

    profile = db.query(models.LecturerProfile).filter(models.LecturerProfile.email == lecturer_email).first()
    if profile:
        db.delete(profile)

    db.delete(lecturer)
    db.commit()

    return {"success": True, "message": "Lecturer removed."}

@app.get("/admin/password-requests")
def admin_password_requests(_: dict = Depends(verify_admin_access), db: Session = Depends(get_db)):
    items = (
        db.query(models.PasswordResetRequest)
        .order_by(models.PasswordResetRequest.created_at.desc())
        .all()
    )

    return [
        {
            "id": str(item.id),
            "lecturerEmail": item.lecturer_email,
            "lecturerTitle": item.lecturer_title,
            "lecturerName": item.lecturer_name,
            "status": item.status,
            "createdAt": item.created_at,
            "reviewedAt": item.reviewed_at,
            "adminNote": item.admin_note,
        }
        for item in items
    ]

@app.post("/admin/password-requests/{requestId}/issue-temp-password")
def admin_issue_temp_password(requestId: str, _: dict = Depends(verify_admin_access), db: Session = Depends(get_db)):
    request_uuid = parse_uuid_or_400(requestId, "requestId")
    item = db.query(models.PasswordResetRequest).filter(models.PasswordResetRequest.id == request_uuid).first()
    if not item:
        raise HTTPException(status_code=404, detail="Password request not found")

    if item.status != "PENDING":
        raise HTTPException(status_code=400, detail="Password request already handled")

    temp_password = generate_temp_password()
    full_name = item.lecturer_name or item.lecturer_email.split("@")[0]
    title = item.lecturer_title or "Lecturer"
    auth_ok, auth_message = upsert_supabase_lecturer(item.lecturer_email, full_name, title, temp_password)

    profile = db.query(models.LecturerProfile).filter(models.LecturerProfile.email == item.lecturer_email).first()
    if profile:
        profile.must_change_password = True
        profile.updated_at = datetime.now(timezone.utc)

    ensure_local_credential(
        db,
        username=item.lecturer_email,
        password=temp_password,
        role="TEACHER",
        user_email=item.lecturer_email,
        force_update=True,
    )

    user = db.query(models.User).filter(models.User.email == item.lecturer_email).first()
    if user and user.is_admin:
        ensure_local_credential(
            db,
            username=item.lecturer_email,
            password=temp_password,
            role="SUPERUSER",
            user_email=item.lecturer_email,
            force_update=True,
        )

    item.status = "ISSUED"
    item.reviewed_at = datetime.now(timezone.utc)
    item.admin_note = "Temporary password issued by admin"
    db.commit()

    return {
        "success": True,
        "tempPassword": temp_password,
        "authProvisioned": auth_ok,
        "authMessage": auth_message,
        "message": "Temporary password generated. Send it to lecturer and require password change after login.",
    }

@app.get("/lecturers/password-policy")
def lecturer_password_policy(email: str, db: Session = Depends(get_db)):
    profile = db.query(models.LecturerProfile).filter(models.LecturerProfile.email == email.strip().lower()).first()
    return {
        "mustChangePassword": bool(profile.must_change_password) if profile else False,
        "title": profile.title if profile else None,
        "fullName": profile.full_name if profile else None,
    }

@app.post("/lecturers/password-policy/clear")
def lecturer_password_policy_clear(req: schemas.LecturerPasswordPolicyClear, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    profile = db.query(models.LecturerProfile).filter(models.LecturerProfile.email == email).first()
    if not profile:
        return {"success": True, "message": "No lecturer policy entry found."}

    profile.must_change_password = False
    profile.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"success": True, "message": "Password policy updated."}

@app.post("/lecturers/password-requests")
def lecturer_password_request(req: schemas.LecturerPasswordRequestCreate, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Lecturer email is required.")

    profile = db.query(models.LecturerProfile).filter(models.LecturerProfile.email == email).first()
    user = db.query(models.User).filter(models.User.email == email).first()

    if not user or user.role != models.UserRole.TEACHER:
        raise HTTPException(status_code=404, detail="Lecturer account not found.")

    pending = (
        db.query(models.PasswordResetRequest)
        .filter(
            models.PasswordResetRequest.lecturer_email == email,
            models.PasswordResetRequest.status == "PENDING",
        )
        .first()
    )
    if pending:
        return {"success": True, "message": "Password request already pending admin review."}

    item = models.PasswordResetRequest(
        id=uuid.uuid4(),
        lecturer_email=email,
        lecturer_title=(profile.title if profile else "Lecturer"),
        lecturer_name=(profile.full_name if profile else user.name),
        status="PENDING",
        created_at=datetime.now(timezone.utc),
    )
    db.add(item)
    db.commit()

    return {"success": True, "message": "Password request sent to admin for validation."}

@app.post("/admin/course-requests/{requestId}/approve")
def admin_approve_course_request(requestId: str, _: dict = Depends(verify_admin_access), db: Session = Depends(get_db)):
    request_uuid = parse_uuid_or_400(requestId, "requestId")
    item = db.query(models.CourseRequest).filter(models.CourseRequest.id == request_uuid).first()
    if not item:
        raise HTTPException(status_code=404, detail="Course request not found")

    if item.status != "PENDING":
        return {"success": True, "message": "Request already reviewed."}

    used_codes = {course.code for course in db.query(models.Course).all()}
    code = normalized_code(item.name, item.course_type, item.code or "", used_codes)

    existing_course = (
        db.query(models.Course)
        .filter(
            models.Course.name == item.name,
            models.Course.course_type == item.course_type,
            models.Course.semester == item.semester,
        )
        .first()
    )

    if not existing_course:
        db.add(
            models.Course(
                id=uuid.uuid4(),
                name=item.name,
                course_type=item.course_type,
                code=code,
                semester=item.semester,
                lecturer_id=None,
            )
        )

    item.status = "APPROVED"
    item.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    return {"success": True, "message": "Course request approved and added to catalog."}

@app.delete("/admin/course-requests/{requestId}")
def admin_reject_course_request(requestId: str, _: dict = Depends(verify_admin_access), db: Session = Depends(get_db)):
    request_uuid = parse_uuid_or_400(requestId, "requestId")
    item = db.query(models.CourseRequest).filter(models.CourseRequest.id == request_uuid).first()
    if not item:
        raise HTTPException(status_code=404, detail="Course request not found")

    db.delete(item)
    db.commit()
    return {"success": True, "message": "Course request rejected and removed."}