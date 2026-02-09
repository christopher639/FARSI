from fastapi import APIRouter, Depends

from ..deps import allow_public_read, require_permission
from ..supabase_client import get_supabase


router = APIRouter(prefix="/network", tags=["network"])


@router.get("", response_model=list[dict])
def list_network_data(_: str | None = Depends(allow_public_read("network.read"))):
    supabase = get_supabase()
    result = supabase.table("network_analysis_data").select("*").order("created_at", desc=True).limit(200).execute()
    return result.data or []


@router.post("", response_model=dict)
def create_network_record(payload: dict, _: str = Depends(require_permission("network.write"))):
    supabase = get_supabase()
    created = supabase.table("network_analysis_data").insert(payload).execute()
    return created.data[0]


@router.put("/{record_id}", response_model=dict)
def update_network_record(record_id: str, payload: dict, _: str = Depends(require_permission("network.write"))):
    supabase = get_supabase()
    updated = supabase.table("network_analysis_data").update(payload).eq("id", record_id).execute()
    return updated.data[0]


@router.delete("/{record_id}")
def delete_network_record(record_id: str, _: str = Depends(require_permission("network.write"))):
    supabase = get_supabase()
    supabase.table("network_analysis_data").delete().eq("id", record_id).execute()
    return {"status": "deleted"}
