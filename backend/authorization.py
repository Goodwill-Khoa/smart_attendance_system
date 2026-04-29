from jose import jwt
from jose.utils import base64url_decode
import requests
import os
from dotenv import load_dotenv
from fastapi import Header, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, HTTPException

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

class Authorization:
    def __init__(self):
        self.jwks = requests.get(JWKS_URL).json()

    def verify_token(self, token: str):
        try:
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

    return {
        "user_id": payload.get("sub"),
        "email": payload.get("email")
    }