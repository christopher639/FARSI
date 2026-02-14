from fastapi import APIRouter, HTTPException, status
from supabase import create_client

from ..config import settings
from ..models import LoginRequest, TokenResponse
from ..supabase_client import get_supabase


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    if not settings.supabase_anon_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="missing_supabase_anon_key")

    client = create_client(settings.supabase_url, settings.supabase_anon_key)
    auth_response = client.auth.sign_in_with_password({"email": payload.email, "password": payload.password})
    if not auth_response or not auth_response.session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")
    role = "viewer"
    if auth_response.user:
        supabase = get_supabase()
        roles = supabase.table("user_roles").select("role").eq("user_id", auth_response.user.id).execute().data or []
        if any(r.get("role") == "admin" for r in roles):
            role = "admin"
        elif any(r.get("role") == "analyst" for r in roles):
            role = "analyst"
        elif any(r.get("role") == "security_agent" for r in roles):
            role = "security_agent"
        elif any(r.get("role") == "viewer" for r in roles):
            role = "viewer"
        elif roles:
            role = roles[0].get("role", "viewer")
    return TokenResponse(access_token=auth_response.session.access_token, role=role)
