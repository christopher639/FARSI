from fastapi import APIRouter, Depends

from ..deps import allow_public_read, require_permission
from ..supabase_client import get_supabase


router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/nodes", response_model=list[dict])
def list_nodes(_: str | None = Depends(allow_public_read("graph.read"))):
    supabase = get_supabase()
    result = supabase.table("entity_nodes").select("*").order("created_at", desc=True).limit(500).execute()
    return result.data or []


@router.get("/edges", response_model=list[dict])
def list_edges(_: str | None = Depends(allow_public_read("graph.read"))):
    supabase = get_supabase()
    result = supabase.table("entity_edges").select("*").order("created_at", desc=True).limit(500).execute()
    return result.data or []


@router.post("/nodes", response_model=dict)
def create_node(payload: dict, _: str = Depends(require_permission("graph.write"))):
    supabase = get_supabase()
    created = supabase.table("entity_nodes").insert(payload).execute()
    return created.data[0]


@router.post("/edges", response_model=dict)
def create_edge(payload: dict, _: str = Depends(require_permission("graph.write"))):
    supabase = get_supabase()
    created = supabase.table("entity_edges").insert(payload).execute()
    return created.data[0]
