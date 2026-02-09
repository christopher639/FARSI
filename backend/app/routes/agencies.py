from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import allow_public_read, require_permission
from ..models import AgencyCreate, AgencyOut
from ..supabase_client import get_supabase


router = APIRouter(prefix="/agencies", tags=["agencies"])


def _to_out(doc: dict[str, Any]) -> AgencyOut:
    return AgencyOut(
        id=doc["id"],
        name=doc["name"],
        code=doc["code"],
        description=doc.get("description"),
        status=doc.get("status", "pending"),
        contact_person=doc.get("contact_person"),
        contact_email=doc.get("contact_email"),
        contact_phone=doc.get("contact_phone"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


@router.get("", response_model=list[AgencyOut])
def list_agencies(_: str | None = Depends(allow_public_read("agencies.read"))):
    supabase = get_supabase()
    result = supabase.table("connected_agencies").select("*").order("updated_at", desc=True).execute()
    return [_to_out(a) for a in (result.data or [])]


@router.post("", response_model=AgencyOut)
def create_agency(payload: AgencyCreate, role: str = Depends(require_permission("agencies.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    doc.update({"created_at": now, "updated_at": now})
    created = supabase.table("connected_agencies").insert(doc).execute().data[0]
    supabase.table("audit_logs").insert(
        {
            "actor": "api",
            "role": role,
            "action": "agencies.create",
            "target": created["id"],
            "metadata": {"code": doc["code"]},
            "created_at": now,
        }
    ).execute()
    return _to_out(created)


@router.put("/{agency_id}", response_model=AgencyOut)
def update_agency(agency_id: str, payload: AgencyCreate, role: str = Depends(require_permission("agencies.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    update = payload.model_dump()
    update["updated_at"] = now
    result = supabase.table("connected_agencies").update(update).eq("id", agency_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agency_not_found")
    supabase.table("audit_logs").insert(
        {
            "actor": "api",
            "role": role,
            "action": "agencies.update",
            "target": agency_id,
            "metadata": {"code": update["code"]},
            "created_at": now,
        }
    ).execute()
    return _to_out(result.data[0])


@router.delete("/{agency_id}")
def delete_agency(agency_id: str, role: str = Depends(require_permission("agencies.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    result = supabase.table("connected_agencies").delete().eq("id", agency_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agency_not_found")
    supabase.table("audit_logs").insert(
        {
            "actor": "api",
            "role": role,
            "action": "agencies.delete",
            "target": agency_id,
            "metadata": {},
            "created_at": now,
        }
    ).execute()
    return {"status": "deleted"}
