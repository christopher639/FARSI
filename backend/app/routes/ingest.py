import csv
import hashlib
import io
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from ..config import settings
from ..deps import require_ingestor
from ..supabase_client import get_supabase


router = APIRouter(prefix="/ingest", tags=["ingest"])

CANONICAL_ALIASES = {
    "crime_type": ["crime type", "crime_type", "type", "offense", "offence", "category", "incident_type", "primary_type"],
    "month": ["month", "report_month", "date", "incident_date", "reported_date", "date_reported", "occurrence_date", "datetime"],
    "location": ["location", "place", "incident_location", "address", "street", "block", "area", "district", "ward", "county", "neighborhood", "suburb"],
    "longitude": ["longitude", "lon", "lng", "long"],
    "latitude": ["latitude", "lat"],
    "reported_by": ["reported by", "reported_by", "reporting_agency"],
    "falls_within": ["falls within", "falls_within", "jurisdiction"],
    "lsoa_code": ["lsoa code", "lsoa_code", "ward_code", "area_code"],
    "lsoa_name": ["lsoa name", "lsoa_name", "ward_name", "area_name", "county_name"],
    "last_outcome_category": ["last outcome category", "last_outcome_category", "outcome", "case_outcome"],
    "crime_id": ["crime id", "crime_id", "incident_id", "id"],
    "context": ["context", "notes", "description"],
}

REQUIRED_CANONICAL = ["crime_type", "longitude", "latitude"]


def _normalize_header(name: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "_" for ch in str(name)).strip("_")


def _build_header_lookup(fieldnames: list[str] | None) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for name in fieldnames or []:
        lookup[_normalize_header(name)] = name
    return lookup


def _field_value(row: dict[str, Any], header_lookup: dict[str, str], canonical: str) -> str:
    for alias in CANONICAL_ALIASES.get(canonical, []):
        key = _normalize_header(alias)
        if key in header_lookup:
            raw = row.get(header_lookup[key])
            return "" if raw is None else str(raw)
    return ""


def _crime_record_hash(row: dict[str, Any]) -> str:
    parts = [
        str(row.get("crime_type", "")),
        str(row.get("month", "")),
        str(row.get("location", "")),
        str(row.get("latitude", "")),
        str(row.get("longitude", "")),
        str(row.get("reported_by", "")),
    ]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def _normalize_month(raw: str) -> str | None:
    value = (raw or "").strip()
    if not value:
        return None

    # Already month-like (YYYY-MM)
    if len(value) >= 7 and value[4] == "-" and value[:4].isdigit() and value[5:7].isdigit():
        return value[:7]

    fmts = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%m/%d/%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%Y-%m-%d %H:%M:%S",
        "%d-%m-%Y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
    ]
    for fmt in fmts:
        try:
            dt = datetime.strptime(value, fmt)
            return dt.strftime("%Y-%m")
        except ValueError:
            continue

    # Last resort: try ISO parser
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m")
    except ValueError:
        return None


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


@router.post("/crime-csv")
def ingest_crime_csv(
    csv_file: UploadFile = File(...),
    source_system: str = Form("data_fusion_upload"),
    source_agency: str | None = Form(None),
    _: str = Depends(require_ingestor),
):
    if not csv_file.filename or not csv_file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="csv_file_required")

    content = csv_file.file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="csv_must_be_utf8")

    reader = csv.DictReader(io.StringIO(text))
    header_lookup = _build_header_lookup(reader.fieldnames)
    missing = [
        field
        for field in REQUIRED_CANONICAL
        if not any(_normalize_header(a) in header_lookup for a in CANONICAL_ALIASES[field])
    ]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"missing_required_columns: {missing}",
        )

    records: list[dict[str, Any]] = []
    total_rows = 0
    invalid_rows = 0

    for row in reader:
        total_rows += 1
        try:
            crime_type = _field_value(row, header_lookup, "crime_type").strip()
            month = _normalize_month(_field_value(row, header_lookup, "month")) or datetime.now(timezone.utc).strftime("%Y-%m")
            location = _field_value(row, header_lookup, "location").strip() or "Unknown"
            lat = float(_field_value(row, header_lookup, "latitude") or "")
            lon = float(_field_value(row, header_lookup, "longitude") or "")
            if not crime_type:
                invalid_rows += 1
                continue
        except (TypeError, ValueError):
            invalid_rows += 1
            continue

        rec = {
            "crime_id": _field_value(row, header_lookup, "crime_id").strip() or None,
            "month": month,
            "reported_by": _field_value(row, header_lookup, "reported_by").strip() or None,
            "falls_within": _field_value(row, header_lookup, "falls_within").strip() or None,
            "longitude": lon,
            "latitude": lat,
            "location": location,
            "lsoa_code": _field_value(row, header_lookup, "lsoa_code").strip() or None,
            "lsoa_name": _field_value(row, header_lookup, "lsoa_name").strip() or None,
            "crime_type": crime_type,
            "last_outcome_category": _field_value(row, header_lookup, "last_outcome_category").strip() or None,
            "context": _field_value(row, header_lookup, "context").strip() or None,
            "geo": {"type": "Point", "coordinates": [lon, lat]},
        }
        rec["record_hash"] = _crime_record_hash(rec)
        records.append(rec)

    if not records:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="no_valid_rows_found")

    supabase = get_supabase()
    inserted = 0
    chunk_size = 500

    for i in range(0, len(records), chunk_size):
        chunk = records[i : i + chunk_size]
        result = supabase.table("crime_events").upsert(chunk, on_conflict="record_hash").execute()
        inserted += len(result.data or [])

    now = datetime.now(timezone.utc).isoformat()
    event_doc = {
        "event_type": "crime_csv_import",
        "title": f"Crime CSV import: {csv_file.filename}",
        "description": (
            f"Imported {inserted} records from {total_rows} CSV rows; "
            f"invalid_rows={invalid_rows}"
        ),
        "modality": "structured",
        "provenance": {
            "source_system": source_system,
            "source_agency": source_agency,
            "ingested_at": now,
            "original_timestamp": None,
            "transformations": ["csv_validation", "record_hash_upsert"],
            "model_version": None,
            "confidence": None,
            "chain_of_custody_id": None,
            "dataset_version": None,
        },
        "created_at": now,
    }
    created = supabase.table("ingestion_events").insert(event_doc).execute().data[0]
    supabase.table("audit_logs").insert(
        {
            "actor": "ingest",
            "role": "ingestor",
            "action": "ingest.crime_csv",
            "target": created["id"],
            "metadata": {
                "source_system": source_system,
                "filename": csv_file.filename,
                "inserted": inserted,
                "invalid_rows": invalid_rows,
            },
            "created_at": now,
        }
    ).execute()

    return {
        "status": "ingested",
        "event_id": created["id"],
        "filename": csv_file.filename,
        "total_rows": total_rows,
        "valid_rows": len(records),
        "invalid_rows": invalid_rows,
        "inserted": inserted,
    }
