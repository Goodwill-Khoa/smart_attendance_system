from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime, time

# --- Auth Schemas ---
class LoginRequest(BaseModel):
    providerToken: str
    role: str # 'STUDENT' or 'TEACHER'

class LoginResponse(BaseModel):
    userId: UUID
    email: str
    name: str
    role: str

class AuthSessionSyncRequest(BaseModel):
    role: str  # STUDENT or TEACHER

class AuthSessionSyncResponse(BaseModel):
    userId: UUID
    email: str
    name: str
    role: str
    isAdmin: bool

# --- Session Schemas ---
class SessionCreate(BaseModel):
    course_id: UUID

class SessionResponse(BaseModel):
    sessionId: UUID
    isActive: bool
    createdAt: datetime

class CourseCreate(BaseModel):
    name: str
    code: str
    semester: str
    course_type: str = "L"

class SemesterDatabaseActivateRequest(BaseModel):
    semester: str
    course_ids: list[UUID]

class TeacherCourseAssignRequest(BaseModel):
    teacher_email: str
    course_id: UUID

class CourseRequestCreate(BaseModel):
    teacher_email: str
    name: str
    semester: str
    course_type: str = "L"
    code: Optional[str] = None

class AdminOverview(BaseModel):
    users: int
    courses: int
    activeSessions: int
    totalSessions: int
    attendanceLogs: int

class AdminEndAllSessionsRequest(BaseModel):
    comment: str

class AdminLecturerCreateRequest(BaseModel):
    title: str
    full_name: str
    email: str
    is_admin: bool = False

class AdminUserAccessUpdate(BaseModel):
    is_admin: bool

class LecturerPasswordRequestCreate(BaseModel):
    email: str

class LecturerPasswordPolicyClear(BaseModel):
    email: str

class CourseRosterUploadSummary(BaseModel):
    courseId: str
    uploadedCount: int
    invalidRows: int
    message: str

# --- Attendance Schemas ---
class ScanRequest(BaseModel):
    token: str # The JWT from the QR code (contains the 8-second timestamp)
    deviceToken: str
    # Note: ip_address is NOT here because backend pulls it directly from the network request.

class ScanResponse(BaseModel):
    success: bool
    message: str

class RfidReaderCreate(BaseModel):
    name: str
    room_name: str

class ClassScheduleCreate(BaseModel):
    course_id: UUID
    room_name: str
    weekday: int
    start_time: time
    end_time: time
    timezone: str = "Europe/Budapest"

class RfidCredentialCreate(BaseModel):
    student_email: str
    student_name: Optional[str] = None
    card_id: str

class RfidEventRequest(BaseModel):
    session_id: Optional[UUID] = None
    card_id: str
    event_type: str

class RfidSimulatorTapRequest(BaseModel):
    session_id: Optional[UUID] = None
    card_id: str
    event_type: str

class RfidSimulatorClockAdvance(BaseModel):
    minutes: int

class RfidEventResponse(BaseModel):
    success: bool
    message: str
    event_type: str
    student_name: str
    occurred_at: datetime