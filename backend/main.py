from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models
import schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Smart Attendance API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Smart Attendance API is running!"}

@app.post("/auth/login", response_model=schemas.LoginResponse)
def login(request: schemas.LoginRequest, db: Session = Depends(get_db)):
    # TODO: Kevin to add Supabase JWT verification and handle 'role' logic here
    return {"userId": "00000000-0000-0000-0000-000000000000", "email": "test@inf.elte.hu", "name": "Test User", "role": request.role}

@app.post("/sessions", response_model=schemas.SessionResponse)
def create_session(session_req: schemas.SessionCreate, db: Session = Depends(get_db)):
    pass

@app.get("/qr/{sessionId}")
def get_qr_token(sessionId: str):
    # TODO: Kevin to generate 8-second hash here
    return {"token": "sample-8-sec-hash", "expiresAt": "2026-04-26T12:00:08Z"}

@app.post("/attendance", response_model=schemas.ScanResponse)
def submit_scan(scan_req: schemas.ScanRequest, request: Request, db: Session = Depends(get_db)):
    # NEW: Automatically capture the Student's IP address for Wi-Fi matching
    client_ip = request.client.host
    
    # TODO: Decode `scan_req.token` to extract `qr_timestamp`
    # TODO: Verify `qr_timestamp` is within 8 seconds of current server time
    # TODO: Check `scan_req.deviceToken` against DB to prevent double scanning
    # TODO: Save attendance to DB with the `client_ip`
    
    return {"success": True, "message": "Attendance recorded successfully."}

@app.get("/sessions/{sessionId}/export")
def export_attendance(sessionId: str, db: Session = Depends(get_db)):
    return {"message": "CSV File Download will trigger here"}