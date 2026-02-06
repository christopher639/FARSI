from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile

from ..config import settings
from ..db import get_db
from ..deps import require_ingestor


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
    db = get_db()
    now = datetime.now(timezone.utc)
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
    result = db["events"].insert_one(doc)
    db["audit_logs"].insert_one(
        {
            "actor": "ingest",
            "role": "ingestor",
            "action": "ingest.text",
            "target": str(result.inserted_id),
            "metadata": {"source_system": source_system},
            "created_at": now,
        }
    )
    return {"status": "ingested", "event_id": str(result.inserted_id)}


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
    db = get_db()
    now = datetime.now(timezone.utc)
    Path(settings.media_storage_dir).mkdir(parents=True, exist_ok=True)
    filename = f"{int(now.timestamp())}_{media.filename}"
    file_path = Path(settings.media_storage_dir) / filename
    with file_path.open("wb") as f:
        f.write(media.file.read())

    doc: dict[str, Any] = {
        "event_type": event_type,
        "title": title,
        "description": None,
        "modality": modality,
        "media_path": str(file_path),
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
    result = db["events"].insert_one(doc)
    db["audit_logs"].insert_one(
        {
            "actor": "ingest",
            "role": "ingestor",
            "action": "ingest.media",
            "target": str(result.inserted_id),
            "metadata": {"source_system": source_system, "media_path": str(file_path)},
            "created_at": now,
        }
    )
    return {"status": "ingested", "event_id": str(result.inserted_id), "media_path": str(file_path)}
