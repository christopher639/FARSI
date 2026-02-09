from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ..deps import get_current_user, require_permission, allow_public_read
from ..models import ThreatAlertCreate, ThreatAlertOut
from ..supabase_client import get_supabase


router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[ThreatAlertOut])
def list_alerts(_: str | None = Depends(allow_public_read("alerts.read"))):
    supabase = get_supabase()
    result = supabase.table("threat_alerts").select("*").order("created_at", desc=True).execute()
    return result.data or []


@router.post("", response_model=ThreatAlertOut)
def create_alert(
    payload: ThreatAlertCreate,
    user: dict | None = Depends(get_current_user),
    _: str = Depends(require_permission("alerts.write")),
):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    created = supabase.table("threat_alerts").insert(
        {
            **payload.model_dump(),
            "created_by": user["id"] if user else None,
            "created_at": now,
            "updated_at": now,
        }
    ).execute()
    return created.data[0]


@router.put("/{alert_id}", response_model=ThreatAlertOut)
def update_alert(alert_id: str, payload: ThreatAlertCreate, _: str = Depends(require_permission("alerts.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    updated = (
        supabase.table("threat_alerts")
        .update({**payload.model_dump(), "updated_at": now})
        .eq("id", alert_id)
        .execute()
    )
    return updated.data[0]


@router.patch("/{alert_id}/status", response_model=ThreatAlertOut)
def update_status(alert_id: str, payload: dict, _: str = Depends(require_permission("alerts.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    status = payload.get("status")
    updated = supabase.table("threat_alerts").update({"status": status, "updated_at": now}).eq("id", alert_id).execute()
    return updated.data[0]


@router.delete("/{alert_id}")
def delete_alert(alert_id: str, _: str = Depends(require_permission("alerts.write"))):
    supabase = get_supabase()
    supabase.table("threat_alerts").delete().eq("id", alert_id).execute()
    return {"status": "deleted"}
