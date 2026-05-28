from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

# --- Auth Schemas ---
class LoginRequest(BaseModel):
    providerToken: str
    role: str # 'STUDENT' or 'TEACHER'

class LoginResponse(BaseModel):
    userId: UUID
    email: str
    name: str
    role: str

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