from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=True)
    role = Column(String, nullable=False, default="STUDENT") # 'STUDENT' or 'TEACHER'
    created_at = Column(DateTime, default=datetime.utcnow)

class Course(Base):
    __tablename__ = "courses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    lecturer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

class Session(Base):
    __tablename__ = "sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("courses.id"))
    lecturer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
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