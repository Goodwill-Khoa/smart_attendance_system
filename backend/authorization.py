from jose import jwt
import requests
import os
import ipaddress
import secrets
from dotenv import load_dotenv
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, HTTPException, Request
from datetime import datetime, timedelta, timezone

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else None
LOCAL_DEMO_AUTH_ENABLED = os.getenv("LOCAL_DEMO_AUTH_ENABLED", "false").strip().lower() == "true"

class Authorization:
    def __init__(self):
        self.jwks = {"keys": []}
        self.local_demo_secret = secrets.token_urlsafe(32)
        self.local_demo_enabled = LOCAL_DEMO_AUTH_ENABLED

        if not JWKS_URL:
            print("AUTH WARNING: SUPABASE_URL is not set. JWT verification is disabled.")
            return

        try:
            self.jwks = requests.get(JWKS_URL, timeout=5).json()
        except requests.RequestException as e:
            print("AUTH WARNING: Failed to fetch JWKS:", e)
            self.jwks = {"keys": []}

    def verify_token(self, token: str, client_host: str | None = None):
        try:
            headers = jwt.get_unverified_header(token)
            if headers.get("alg") == "HS256":
                if not LOCAL_DEMO_AUTH_ENABLED:
                    return None
                if not client_host or not ipaddress.ip_address(client_host).is_loopback:
                    return None
                payload = jwt.decode(
                    token,
                    self.local_demo_secret,
                    algorithms=["HS256"],
                    issuer="smart-attendance-local-demo",
                    options={"verify_aud": False},
                )
                if payload.get("local_demo") is not True:
                    return None
                return payload

            if not self.jwks.get("keys"):
                return None

            kid = headers["kid"]

            key_data = next(k for k in self.jwks["keys"] if k["kid"] == kid)

            payload = jwt.decode(
                token,
                key_data,
                algorithms=["ES256"],
                options={"verify_aud": False}
            )

            return payload

        except Exception as e:
            print("JWT ERROR:", e)
            return None

    def create_local_demo_token(self, claims: dict):
        if not LOCAL_DEMO_AUTH_ENABLED:
            raise RuntimeError("Local demo authentication is disabled.")

        now = datetime.now(timezone.utc)
        payload = {
            **claims,
            "iss": "smart-attendance-local-demo",
            "iat": now,
            "exp": now + timedelta(hours=8),
            "local_demo": True,
        }
        return jwt.encode(payload, self.local_demo_secret, algorithm="HS256")

auth = Authorization()

security = HTTPBearer()

def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials
    client_host = request.client.host if request.client else None
    payload = auth.verify_token(token, client_host=client_host)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_metadata = payload.get("user_metadata") or {}
    display_name = (
        user_metadata.get("name")
        or user_metadata.get("full_name")
        or payload.get("email", "").split("@")[0]
    )

    return {
        "user_id": payload.get("sub"),
        "email": payload.get("email"),
        "name": display_name,
    }