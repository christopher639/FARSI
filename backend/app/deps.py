import requests
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .rbac import role_has_permission
from .security import hash_api_key
from .supabase_client import get_supabase


security = HTTPBearer(auto_error=False)


def _fetch_user_from_token(token: str) -> dict | None:
    if not settings.supabase_anon_key:
        return None
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": settings.supabase_anon_key,
    }
    url = f"{settings.supabase_url}/auth/v1/user"
    response = requests.get(url, headers=headers, timeout=5)
    if response.status_code != 200:
        return None
    return response.json()


def _fetch_user_role(user_id: str) -> str | None:
    client = get_supabase()
    result = client.table("user_roles").select("role").eq("user_id", user_id).execute()
    roles = [r.get("role") for r in (result.data or []) if r.get("role")]
    if not roles:
        return None
    if "admin" in roles:
        return "admin"
    if "analyst" in roles:
        return "analyst"
    if "security_agent" in roles:
        return "security_agent"
    if "viewer" in roles:
        return "viewer"
    return roles[0]


def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict | None:
    if creds is None:
        return None
    token = creds.credentials
    return _fetch_user_from_token(token)


def get_current_role(
    user: dict | None = Depends(get_current_user),
) -> str | None:
    if not user:
        return None
    role = _fetch_user_role(user.get("id"))
    return role or None


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
