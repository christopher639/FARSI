from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile

from ..config import settings
from ..deps import require_ingestor
from ..supabase_client import get_supabase


router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/text")
def ingest_text(
    event_type: str = Form(...),
    title: str = Form(...),
    description: str | None = Form(None),
    source_system: str = Form(...),
    source_agency: str | None = Form(None),
    original_timestamp: str | None = Form(None),
    modality: str = Form("text"),
    _: str = Depends(require_ingestor),
):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    doc: dict[str, Any] = {
        "event_type": event_type,
        "title": title,
        "description": description,
        "modality": modality,
        "provenance": {
            "source_system": source_system,
            "source_agency": source_agency,
            "ingested_at": now,
            "original_timestamp": original_timestamp,
            "transformations": [],
            "model_version": None,
            "confidence": None,
            "chain_of_custody_id": None,
            "dataset_version": None,
        },
        "created_at": now,
    }
    created = supabase.table("ingestion_events").insert(doc).execute().data[0]
    supabase.table("audit_logs").insert(
        {
            "actor": "ingest",
            "role": "ingestor",
            "action": "ingest.text",
            "target": created["id"],
            "metadata": {"source_system": source_system},
            "created_at": now,
        }
    ).execute()
    return {"status": "ingested", "event_id": created["id"]}


@router.post("/media")
def ingest_media(
    event_type: str = Form(...),
    title: str = Form(...),
    source_system: str = Form(...),
    media: UploadFile = File(...),
    source_agency: str | None = Form(None),
    modality: str = Form("cctv"),
    _: str = Depends(require_ingestor),
):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    filename = f"{int(datetime.now(timezone.utc).timestamp())}_{media.filename}"
    file_bytes = media.file.read()
    supabase.storage.from_(settings.media_bucket).upload(
        filename,
        file_bytes,
        {"content-type": media.content_type or "application/octet-stream"},
    )
    storage_path = f"{settings.media_bucket}/{filename}"

    doc: dict[str, Any] = {
        "event_type": event_type,
        "title": title,
        "description": None,
        "modality": modality,
        "media_path": storage_path,
        "provenance": {
            "source_system": source_system,
            "source_agency": source_agency,
            "ingested_at": now,
            "original_timestamp": None,
            "transformations": ["stored_raw_media"],
            "model_version": None,
            "confidence": None,
            "chain_of_custody_id": None,
            "dataset_version": None,
        },
        "created_at": now,
    }
    created = supabase.table("ingestion_events").insert(doc).execute().data[0]
    supabase.table("audit_logs").insert(
        {
            "actor": "ingest",
            "role": "ingestor",
            "action": "ingest.media",
            "target": created["id"],
            "metadata": {"source_system": source_system, "media_path": storage_path},
            "created_at": now,
        }
    ).execute()
    return {"status": "ingested", "event_id": created["id"], "media_path": storage_path}
