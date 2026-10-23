from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum, UniqueConstraint, Integer, Time
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from database import Base
import enum

class UserRole(str, enum.Enum):
    STUDENT = "STUDENT"
    TEACHER = "TEACHER"

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    role = Column(Enum(UserRole, name="user_role"), nullable=False, default=UserRole.STUDENT)
    is_admin = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Course(Base):
    __tablename__ = "courses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    course_type = Column(String, nullable=False, default="L")
    code = Column(String, unique=True, nullable=False)
    semester = Column(String, nullable=False, default="Spring 2026")
    lecturer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class Session(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        UniqueConstraint("schedule_id", "scheduled_start", name="uq_sessions_schedule_occurrence"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"))
    lecturer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("class_schedules.id"), nullable=True)
    scheduled_start = Column(DateTime, nullable=True)
    scheduled_end = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

class AttendanceLog(Base):
    __tablename__ = "attendance_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    device_id = Column(String, nullable=False) 
    ip_address = Column(String, nullable=True) # NEW: Maxim's Wi-Fi/IP verification
    qr_timestamp = Column(DateTime, nullable=False) # NEW: Khoa's 8-second validation logic
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="PRESENT") # "PRESENT" or "REJECTED_LATE"
    checked_out_at = Column(DateTime, nullable=True)
    source = Column(String, nullable=False, default="QR")

class StudentCardCredential(Base):
    __tablename__ = "student_card_credentials"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    credential_hash = Column(String, unique=True, nullable=False, index=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked_at = Column(DateTime, nullable=True)

class RfidReader(Base):
    __tablename__ = "rfid_readers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    room_name = Column(String, nullable=True, index=True)
    key_hash = Column(String, unique=True, nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ClassSchedule(Base):
    __tablename__ = "class_schedules"
    __table_args__ = (
        UniqueConstraint("room_name", "weekday", "start_time", name="uq_class_schedule_room_weekday_start"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False, index=True)
    room_name = Column(String, nullable=False, index=True)
    weekday = Column(Integer, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    timezone = Column(String, nullable=False, default="Europe/Budapest")
    schedule_source = Column(String, nullable=False, default="LECTURER")
    active = Column(Boolean, nullable=False, default=True)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class AttendanceEvent(Base):
    __tablename__ = "attendance_events"
    __table_args__ = (
        UniqueConstraint("session_id", "user_id", "event_type", name="uq_attendance_events_session_user_type"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    credential_id = Column(UUID(as_uuid=True), ForeignKey("student_card_credentials.id"), nullable=True)
    reader_id = Column(UUID(as_uuid=True), ForeignKey("rfid_readers.id"), nullable=True)
    event_type = Column(String, nullable=False)
    source = Column(String, nullable=False)
    occurred_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class RfidTapEvent(Base):
    __tablename__ = "rfid_tap_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    credential_id = Column(UUID(as_uuid=True), ForeignKey("student_card_credentials.id"), nullable=False, index=True)
    reader_id = Column(UUID(as_uuid=True), ForeignKey("rfid_readers.id"), nullable=False, index=True)
    event_type = Column(String, nullable=False)
    source = Column(String, nullable=False)
    occurred_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)

class RfidSimulatorClock(Base):
    __tablename__ = "rfid_simulator_clock"
    id = Column(Integer, primary_key=True, default=1)
    current_time = Column(DateTime, nullable=False)

class TeacherCourseAssignment(Base):
    __tablename__ = "teacher_course_assignments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_email = Column(String, nullable=False, index=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class CourseRequest(Base):
    __tablename__ = "course_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_email = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    course_type = Column(String, nullable=False, default="L")
    code = Column(String, nullable=True)
    semester = Column(String, nullable=False)
    status = Column(String, nullable=False, default="PENDING")
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewer_note = Column(String, nullable=True)

class EmergencyBroadcast(Base):
    __tablename__ = "emergency_broadcasts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message = Column(String, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class LecturerProfile(Base):
    __tablename__ = "lecturer_profiles"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False, default="Lecturer")
    full_name = Column(String, nullable=False)
    must_change_password = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

class PasswordResetRequest(Base):
    __tablename__ = "password_reset_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lecturer_email = Column(String, nullable=False, index=True)
    lecturer_title = Column(String, nullable=True)
    lecturer_name = Column(String, nullable=True)
    status = Column(String, nullable=False, default="PENDING")
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    admin_note = Column(String, nullable=True)

class LocalCredential(Base):
    __tablename__ = "local_credentials"
    __table_args__ = (
        UniqueConstraint("username", "role", name="uq_local_credentials_username_role"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # TEACHER or SUPERUSER
    user_email = Column(String, nullable=True, index=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

class CourseStudentRegistry(Base):
    __tablename__ = "course_student_registry"
    __table_args__ = (
        UniqueConstraint("course_id", "student_email", name="uq_course_student_registry_course_email"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False, index=True)
    student_email = Column(String, nullable=False, index=True)
    student_name = Column(String, nullable=True)
    uploaded_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)