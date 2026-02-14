from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ..deps import allow_public_read, get_current_user, require_permission
from ..models import CrimeReportCreate, CrimeReportOut
from ..supabase_client import get_supabase


router = APIRouter(prefix="/crime-reports", tags=["crime-reports"])


def _month_key(ts: datetime) -> str:
    return ts.strftime("%Y-%m")


def _crime_id(ts: datetime) -> str:
    return f"AGENT-{ts.strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(2).upper()}"


def _record_hash(*parts: str) -> str:
    key = "|".join(parts)
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


@router.get("", response_model=list[CrimeReportOut])
def list_crime_reports(_: str | None = Depends(allow_public_read("events.read"))):
    supabase = get_supabase()
    result = (
        supabase.table("crime_events")
        .select("id,crime_id,crime_type,context,location,latitude,longitude,reported_by,month,created_at")
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    return result.data or []


@router.post("", response_model=CrimeReportOut)
def create_crime_report(
    payload: CrimeReportCreate,
    user: dict | None = Depends(get_current_user),
    _: str = Depends(require_permission("reports.write")),
):
    supabase = get_supabase()
    now = payload.reported_at or datetime.now(timezone.utc)
    crime_id = _crime_id(now)
    reported_by = user["id"] if user else "unknown"

    row = {
        "crime_id": crime_id,
        "crime_type": payload.crime_type,
        "context": payload.description,
        "location": payload.location_label,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "reported_by": reported_by,
        "month": _month_key(now),
        "record_hash": _record_hash(
            payload.crime_type,
            f"{payload.latitude:.6f}",
            f"{payload.longitude:.6f}",
            reported_by,
            now.isoformat(),
        ),
        "created_at": now.isoformat(),
    }

    created = (
        supabase.table("crime_events")
        .insert(row)
        .select("id,crime_id,crime_type,context,location,latitude,longitude,reported_by,month,created_at")
        .single()
        .execute()
    )
    return created.data
