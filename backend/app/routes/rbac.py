from fastapi import APIRouter, Depends

from ..deps import allow_public_read
from ..rbac import ROLE_PERMISSIONS


router = APIRouter(prefix="/rbac", tags=["rbac"])


@router.get("/roles")
def list_roles(_: str | None = Depends(allow_public_read("rbac.read"))):
    return ROLE_PERMISSIONS
