from fastapi import APIRouter, Depends

from ..deps import allow_public_read, require_permission
from ..models import ModelRegistryCreate, ModelRegistryOut
from ..supabase_client import get_supabase


router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=list[ModelRegistryOut])
def list_models(_: str | None = Depends(allow_public_read("models.read"))):
    supabase = get_supabase()
    result = supabase.table("ml_models").select("*").order("created_at", desc=True).execute()
    return result.data or []


@router.post("", response_model=ModelRegistryOut)
def create_model(payload: ModelRegistryCreate, _: str = Depends(require_permission("models.write"))):
    supabase = get_supabase()
    created = supabase.table("ml_models").insert(payload.model_dump()).execute().data[0]
    return created
