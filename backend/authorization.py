from jose import jwt
import requests
import os
from dotenv import load_dotenv
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, HTTPException

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else None

class Authorization:
    def __init__(self):
        self.jwks = {"keys": []}

        if not JWKS_URL:
            print("AUTH WARNING: SUPABASE_URL is not set. JWT verification is disabled.")
            return

        try:
            self.jwks = requests.get(JWKS_URL, timeout=5).json()
        except requests.RequestException as e:
            print("AUTH WARNING: Failed to fetch JWKS:", e)
            self.jwks = {"keys": []}

    def verify_token(self, token: str):
        try:
            if not self.jwks.get("keys"):
                return None

            headers = jwt.get_unverified_header(token)
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

auth = Authorization()

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials

    payload = auth.verify_token(token)

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