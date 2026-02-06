from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..db import get_db
from ..deps import allow_public_read, require_permission
from ..models import EventCreate, EventOut


router = APIRouter(prefix="/events", tags=["events"])


def _to_out(doc: dict[str, Any]) -> EventOut:
    return EventOut(
        id=str(doc["_id"]),
        event_type=doc["event_type"],
        title=doc["title"],
        description=doc.get("description"),
        location=doc.get("location"),
        entities=doc.get("entities"),
        tags=doc.get("tags", []),
        severity=doc.get("severity"),
        modality=doc.get("modality", "text"),
        provenance=doc["provenance"],
        created_at=doc["created_at"],
    )


@router.get("", response_model=list[EventOut])
def list_events(
    limit: int = Query(50, ge=1, le=200),
    _: str | None = Depends(allow_public_read("events.read")),
):
    db = get_db()
    docs = db["events"].find().sort("created_at", -1).limit(limit)
    return [_to_out(d) for d in docs]


@router.post("", response_model=EventOut)
def create_event(payload: EventCreate, _: str = Depends(require_permission("events.write"))):
    db = get_db()
    now = datetime.now(timezone.utc)
    doc = payload.model_dump()
    doc.update({"created_at": now})
    result = db["events"].insert_one(doc)
    created = db["events"].find_one({"_id": result.inserted_id})
    return _to_out(created)


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: str, _: str | None = Depends(allow_public_read("events.read"))):
    db = get_db()
    doc = db["events"].find_one({"_id": ObjectId(event_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="event_not_found")
    return _to_out(doc)
