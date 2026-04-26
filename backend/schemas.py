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

# --- Attendance Schemas ---
class ScanRequest(BaseModel):
    token: str # The JWT from the QR code (contains the 8-second timestamp)
    deviceToken: str
    # Note: ip_address is NOT here because backend pulls it directly from the network request.

class ScanResponse(BaseModel):
    success: bool
    message: str