from fastapi import APIRouter, Depends

from ..deps import allow_public_read
from ..supabase_client import get_supabase


router = APIRouter(prefix="/heatmap", tags=["heatmap"])


@router.get("", response_model=list[dict])
def list_heatmap(_: str | None = Depends(allow_public_read("heatmap.read"))):
    supabase = get_supabase()
    result = supabase.table("threat_heatmap_cells").select("*").order("created_at", desc=True).limit(500).execute()
    return result.data or []
