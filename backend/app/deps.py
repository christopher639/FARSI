from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .rbac import role_has_permission
from .security import decode_token, hash_api_key
from .db import get_db


security = HTTPBearer(auto_error=False)


def get_current_role(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> str | None:
    if creds is None:
        return None
    token = creds.credentials
    try:
        payload = decode_token(token)
        return payload.get("role")
    except Exception:
        return None


def require_permission(permission: str):
    def _checker(role: str | None = Depends(get_current_role)) -> str:
        if role is None or not role_has_permission(role, permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_permissions")
        return role

    return _checker


def allow_public_read(permission: str):
    def _checker(role: str | None = Depends(get_current_role)) -> str | None:
        if role is None and settings.allow_public_read and permission in {"events.read", "agencies.read"}:
            return None
        if role is None or not role_has_permission(role, permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_permissions")
        return role

    return _checker


def require_ingest_key(request: Request) -> str | None:
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        return None
    if not settings.ingest_api_key:
        return None
    expected = hash_api_key(settings.ingest_api_key, "farsi")
    provided = hash_api_key(api_key, "farsi")
    if provided != expected:
        return None
    return "ingestor"


def require_ingestor(
    request: Request,
    role: str | None = Depends(get_current_role),
) -> str:
    if role and role_has_permission(role, "ingest.write"):
        return role
    api_key_role = require_ingest_key(request)
    if api_key_role:
        return api_key_role
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_permissions")


def get_user_by_email(email: str):
    db = get_db()
    return db["users"].find_one({"email": email})
