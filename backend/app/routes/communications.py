from fastapi import APIRouter, Depends

from ..deps import allow_public_read, require_permission
from ..supabase_client import get_supabase


router = APIRouter(prefix="/communications", tags=["communications"])


@router.get("", response_model=list[dict])
def list_communications(_: str | None = Depends(allow_public_read("communications.read"))):
    supabase = get_supabase()
    result = supabase.table("communications_monitoring").select("*").order("created_at", desc=True).limit(100).execute()
    return result.data or []


@router.post("", response_model=dict)
def create_communication(payload: dict, _: str = Depends(require_permission("communications.write"))):
    supabase = get_supabase()
    created = supabase.table("communications_monitoring").insert(payload).execute()
    return created.data[0]


@router.put("/{comm_id}", response_model=dict)
def update_communication(comm_id: str, payload: dict, _: str = Depends(require_permission("communications.write"))):
    supabase = get_supabase()
    updated = supabase.table("communications_monitoring").update(payload).eq("id", comm_id).execute()
    return updated.data[0]


@router.delete("/{comm_id}")
def delete_communication(comm_id: str, _: str = Depends(require_permission("communications.write"))):
    supabase = get_supabase()
    supabase.table("communications_monitoring").delete().eq("id", comm_id).execute()
    return {"status": "deleted"}
