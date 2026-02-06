from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

from ..db import get_db
from ..models import LoginRequest, TokenResponse
from ..security import create_access_token, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    db = get_db()
    user = db["users"].find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")

    if user.get("status") != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user_inactive")

    token = create_access_token(subject=str(user["_id"]), role=user.get("role", "viewer"))
    db["audit_logs"].insert_one(
        {
            "actor": user["email"],
            "role": user.get("role", "viewer"),
            "action": "auth.login",
            "target": "self",
            "metadata": {"user_id": str(user["_id"])},
            "created_at": datetime.now(timezone.utc),
        }
    )
    return TokenResponse(access_token=token, role=user.get("role", "viewer"))
