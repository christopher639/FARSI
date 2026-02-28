from fastapi import APIRouter, Depends, Query

from ..deps import require_permission
from ..supabase_client import get_supabase


router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_audit_events(
    limit: int = Query(50, ge=1, le=200),
    action: str | None = Query(None),
    actor: str | None = Query(None),
    _: str = Depends(require_permission("audit.read")),
):
    supabase = get_supabase()
    query = supabase.table("audit_logs").select("*").order("created_at", desc=True).limit(limit)
    if action:
        query = query.ilike("action", f"%{action}%")
    if actor:
        query = query.ilike("actor", f"%{actor}%")
    result = query.execute()
    return result.data or []


@router.get("/summary")
def audit_summary(_: str = Depends(require_permission("audit.read"))):
    supabase = get_supabase()
    result = supabase.table("audit_logs").select("action,created_at,actor").order("created_at", desc=True).limit(1000).execute()
    rows = result.data or []
    by_action: dict[str, int] = {}
    by_actor: dict[str, int] = {}
    for row in rows:
        act = row.get("action") or "unknown"
        by_action[act] = by_action.get(act, 0) + 1
        src = row.get("actor") or "unknown"
        by_actor[src] = by_actor.get(src, 0) + 1
    return {
        "event_count": len(rows),
        "top_actions": sorted(by_action.items(), key=lambda kv: kv[1], reverse=True)[:10],
        "top_actors": sorted(by_actor.items(), key=lambda kv: kv[1], reverse=True)[:10],
    }
