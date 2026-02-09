from fastapi import APIRouter, Depends, Query

from ..deps import require_permission
from ..supabase_client import get_supabase


router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_audit_events(
    limit: int = Query(50, ge=1, le=200),
    _: str = Depends(require_permission("audit.read")),
):
    supabase = get_supabase()
    result = supabase.table("audit_logs").select("*").order("created_at", desc=True).limit(limit).execute()
    return result.data or []
