from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ..deps import allow_public_read, require_permission
from ..models import SurveillanceStreamCreate, SurveillanceStreamOut, SurveillanceFrameCreate, SurveillanceFrameOut
from ..supabase_client import get_supabase


router = APIRouter(prefix="/surveillance", tags=["surveillance"])


@router.get("/streams", response_model=list[SurveillanceStreamOut])
def list_streams(_: str | None = Depends(allow_public_read("surveillance.read"))):
    supabase = get_supabase()
    result = supabase.table("surveillance_streams").select("*").order("created_at", desc=True).execute()
    return result.data or []


@router.post("/streams", response_model=SurveillanceStreamOut)
def create_stream(payload: SurveillanceStreamCreate, _: str = Depends(require_permission("surveillance.write"))):
    supabase = get_supabase()
    created = supabase.table("surveillance_streams").insert(payload.model_dump()).execute()
    return created.data[0]


@router.post("/streams/{stream_id}/heartbeat")
def stream_heartbeat(stream_id: str, _: str = Depends(require_permission("surveillance.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    updated = (
        supabase.table("surveillance_streams")
        .update({"last_heartbeat": now, "status": "active"})
        .eq("id", stream_id)
        .execute()
    )
    return {"status": "ok", "stream": updated.data[0] if updated.data else None}


@router.get("/frames", response_model=list[SurveillanceFrameOut])
def list_frames(_: str | None = Depends(allow_public_read("surveillance.read"))):
    supabase = get_supabase()
    result = supabase.table("surveillance_frames").select("*").order("captured_at", desc=True).limit(100).execute()
    return result.data or []


@router.post("/frames", response_model=SurveillanceFrameOut)
def create_frame(payload: SurveillanceFrameCreate, _: str = Depends(require_permission("surveillance.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    created = supabase.table("surveillance_frames").insert(
        {**payload.model_dump(), "captured_at": now, "created_at": now}
    ).execute()
    return created.data[0]


@router.get("/logs", response_model=list[dict])
def list_logs(_: str | None = Depends(allow_public_read("surveillance.read"))):
    supabase = get_supabase()
    result = supabase.table("surveillance_logs").select("*").order("timestamp", desc=True).limit(200).execute()
    return result.data or []


@router.post("/logs", response_model=dict)
def create_log(payload: dict, _: str = Depends(require_permission("surveillance.write"))):
    supabase = get_supabase()
    created = supabase.table("surveillance_logs").insert(payload).execute()
    return created.data[0]


@router.put("/logs/{log_id}", response_model=dict)
def update_log(log_id: str, payload: dict, _: str = Depends(require_permission("surveillance.write"))):
    supabase = get_supabase()
    updated = supabase.table("surveillance_logs").update(payload).eq("id", log_id).execute()
    return updated.data[0]


@router.delete("/logs/{log_id}")
def delete_log(log_id: str, _: str = Depends(require_permission("surveillance.write"))):
    supabase = get_supabase()
    supabase.table("surveillance_logs").delete().eq("id", log_id).execute()
    return {"status": "deleted"}
