from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends

from ..deps import allow_public_read
from ..models import HeatmapAreaSummary
from ..supabase_client import get_supabase


CRIME_SEVERITY: dict[str, int] = {
    "Anti-social behaviour": 2,
    "Burglary": 4,
    "Criminal damage and arson": 3,
    "Drugs": 4,
    "Other theft": 2,
    "Possession of weapons": 5,
    "Public order": 3,
    "Robbery": 5,
    "Shoplifting": 2,
    "Vehicle crime": 3,
    "Violence and sexual offences": 5,
}


def severity_for(crime_type: str | None) -> int:
    if not crime_type:
        return 3
    return CRIME_SEVERITY.get(crime_type.strip(), 3)


def parse_area_from_location(location: str | None) -> str:
    if not location:
        return "Unknown"
    part = location.split(",")[0].strip()
    if not part:
        return "Unknown"
    return part


def tier_from_score(score: float) -> Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
    if score >= 75:
        return "CRITICAL"
    if score >= 55:
        return "HIGH"
    if score >= 35:
        return "MEDIUM"
    return "LOW"


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


router = APIRouter(prefix="/heatmap", tags=["heatmap"])


def _to_float(value: float | int | str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


@router.get("", response_model=list[dict])
def list_heatmap(_: str | None = Depends(allow_public_read("heatmap.read"))):
    supabase = get_supabase()
    result = supabase.table("threat_heatmap_cells").select("*").order("created_at", desc=True).limit(500).execute()
    return result.data or []


@router.get("/summary", response_model=list[HeatmapAreaSummary])
def list_heatmap_summary(_: str | None = Depends(allow_public_read("heatmap.read"))):
    supabase = get_supabase()
    result = (
        supabase.table("crime_events")
        .select(
            "latitude, longitude, crime_type, location, area_name, context, last_outcome_category, created_at"
        )
        .order("created_at", desc=True)
        .limit(1000)
        .execute()
    )
    rows = result.data or []
    stats: dict[str, dict[str, float | int | datetime | None]] = {}
    for row in rows:
        lat = _to_float(row.get("latitude"))
        lon = _to_float(row.get("longitude"))
        if lat is None or lon is None:
            continue

        area = (row.get("area_name") or parse_area_from_location(row.get("location"))).strip() or "Unknown"
        entry = stats.get(area)
        if entry is None:
            entry = {
                "incidents": 0,
                "severity_sum": 0.0,
                "open_cases": 0.0,
                "border_cases": 0.0,
                "lat_sum": 0.0,
                "lon_sum": 0.0,
                "last_reported_at": None,
            }
            stats[area] = entry

        severity = severity_for(row.get("crime_type"))
        entry["incidents"] = int(entry["incidents"]) + 1
        entry["severity_sum"] = float(entry["severity_sum"]) + severity
        entry["lat_sum"] = float(entry["lat_sum"]) + lat
        entry["lon_sum"] = float(entry["lon_sum"]) + lon

        outcome = (row.get("last_outcome_category") or "").lower()
        if "under investigation" in outcome or "awaiting" in outcome or "open" in outcome:
            entry["open_cases"] = float(entry["open_cases"]) + 1

        context = (row.get("context") or "").lower()
        if "border" in context:
            entry["border_cases"] = float(entry["border_cases"]) + 1

        created_at = parse_datetime(row.get("created_at"))
        current_last = entry["last_reported_at"]
        if isinstance(current_last, datetime):
            entry["last_reported_at"] = max(current_last, created_at) if created_at else current_last
        else:
            entry["last_reported_at"] = created_at or current_last

    if not stats:
        return []

    max_incidents = max(int(value["incidents"]) for value in stats.values())
    max_incidents = max(max_incidents, 1)

    summary: list[HeatmapAreaSummary] = []
    for area, value in stats.items():
        incidents = int(value["incidents"])
        severity_sum = float(value["severity_sum"]) if value["severity_sum"] else 0.0
        avg_severity = severity_sum / incidents if incidents else 0.0
        open_cases = float(value["open_cases"]) if value["open_cases"] else 0.0
        border_cases = float(value["border_cases"]) if value["border_cases"] else 0.0
        risk_score = 100 * (
            0.4 * (incidents / max_incidents)
            + 0.25 * (avg_severity / 5)
            + 0.2 * (open_cases / incidents if incidents else 0)
            + 0.15 * (border_cases / incidents if incidents else 0)
        )
        summary.append(
            HeatmapAreaSummary(
                area=area,
                incidents=incidents,
                avg_severity=avg_severity,
                open_case_rate=(open_cases / incidents) if incidents else 0.0,
                border_exposure_rate=(border_cases / incidents) if incidents else 0.0,
                risk_score=risk_score,
                tier=tier_from_score(risk_score),
                centroid=(float(value["lat_sum"]) / incidents if incidents else 0.0, float(value["lon_sum"]) / incidents if incidents else 0.0),
                last_reported_at=value["last_reported_at"] if isinstance(value["last_reported_at"], datetime) else None,
            )
        )

    summary.sort(key=lambda entry: entry.risk_score, reverse=True)
    return summary
