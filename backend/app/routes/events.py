from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..audit_utils import log_audit_event
from ..config import settings
from ..deps import allow_public_read, require_permission
from ..models import EventCreate, EventOut
from ..privacy import anonymize_event_record
from ..supabase_client import get_supabase


router = APIRouter(prefix="/events", tags=["events"])


def _to_out(doc: dict[str, Any]) -> EventOut:
    return EventOut(
        id=doc["id"],
        event_type=doc["event_type"],
        title=doc["title"],
        description=doc.get("description"),
        location=doc.get("location"),
        entities=doc.get("entities"),
        tags=doc.get("tags", []),
        severity=doc.get("severity"),
        modality=doc.get("modality", "text"),
        media_path=doc.get("media_path"),
        provenance=doc["provenance"],
        created_at=doc["created_at"],
    )


@router.get("", response_model=list[EventOut])
def list_events(
    limit: int = Query(50, ge=1, le=200),
    role: str | None = Depends(allow_public_read("events.read")),
):
    supabase = get_supabase()
    result = supabase.table("ingestion_events").select("*").order("created_at", desc=True).limit(limit).execute()
    records = result.data or []
    should_anonymize = settings.anonymize_read_responses and role in {None, "viewer", "security_agent", "auditor"}
    if should_anonymize:
        records = [anonymize_event_record(r) for r in records]
    return [_to_out(d) for d in records]


@router.post("", response_model=EventOut)
def create_event(payload: EventCreate, _: str = Depends(require_permission("events.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    doc.update({"created_at": now})
    created = supabase.table("ingestion_events").insert(doc).execute().data[0]
    return _to_out(created)


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: str, role: str | None = Depends(allow_public_read("events.read"))):
    supabase = get_supabase()
    result = supabase.table("ingestion_events").select("*").eq("id", event_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="event_not_found")
    item = result.data[0]
    should_anonymize = settings.anonymize_read_responses and role in {None, "viewer", "security_agent", "auditor"}
    if should_anonymize:
        item = anonymize_event_record(item)
    return _to_out(item)


@router.delete("/{event_id}")
def delete_event(event_id: str, role: str = Depends(require_permission("events.write"))):
    supabase = get_supabase()
    result = supabase.table("ingestion_events").delete().eq("id", event_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="event_not_found")
    log_audit_event(action="events.delete", target=event_id, role=role, metadata={})
    return {"status": "deleted"}
