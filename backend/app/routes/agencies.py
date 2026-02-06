from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo import ReturnDocument
from fastapi import APIRouter, Depends, HTTPException, status

from ..db import get_db
from ..deps import allow_public_read, require_permission
from ..models import AgencyCreate, AgencyOut


router = APIRouter(prefix="/agencies", tags=["agencies"])


def _to_out(doc: dict[str, Any]) -> AgencyOut:
    return AgencyOut(
        id=str(doc["_id"]),
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
    db = get_db()
    agencies = db["agencies"].find().sort("updated_at", -1)
    return [_to_out(a) for a in agencies]


@router.post("", response_model=AgencyOut)
def create_agency(payload: AgencyCreate, role: str = Depends(require_permission("agencies.write"))):
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = payload.model_dump()
    doc.update({"created_at": now, "updated_at": now})
    result = db["agencies"].insert_one(doc)
    created = db["agencies"].find_one({"_id": result.inserted_id})
    db["audit_logs"].insert_one(
        {
            "actor": "api",
            "role": role,
            "action": "agencies.create",
            "target": str(result.inserted_id),
            "metadata": {"code": doc["code"]},
            "created_at": now,
        }
    )
    return _to_out(created)


@router.put("/{agency_id}", response_model=AgencyOut)
def update_agency(agency_id: str, payload: AgencyCreate, role: str = Depends(require_permission("agencies.write"))):
    db = get_db()
    now = datetime.now(timezone.utc)
    update = payload.model_dump()
    update["updated_at"] = now
    result = db["agencies"].find_one_and_update(
        {"_id": ObjectId(agency_id)},
        {"$set": update},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agency_not_found")
    db["audit_logs"].insert_one(
        {
            "actor": "api",
            "role": role,
            "action": "agencies.update",
            "target": agency_id,
            "metadata": {"code": update["code"]},
            "created_at": now,
        }
    )
    return _to_out(result)


@router.delete("/{agency_id}")
def delete_agency(agency_id: str, role: str = Depends(require_permission("agencies.write"))):
    db = get_db()
    now = datetime.now(timezone.utc)
    result = db["agencies"].delete_one({"_id": ObjectId(agency_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agency_not_found")
    db["audit_logs"].insert_one(
        {
            "actor": "api",
            "role": role,
            "action": "agencies.delete",
            "target": agency_id,
            "metadata": {},
            "created_at": now,
        }
    )
    return {"status": "deleted"}
