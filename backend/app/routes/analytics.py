from fastapi import APIRouter, Depends
from typing import Any

from ..deps import allow_public_read
from ..supabase_client import get_supabase

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/crime-patterns")
def crime_patterns(_: str | None = Depends(allow_public_read("events.read"))):
    supabase = get_supabase()
    # Provide sample batch for ML training; featurize time, geography, and metadata
    result = (
        supabase.table("crime_events")
        .select(
            """
            id,
            crime_id,
            crime_type,
            context,
            location,
            latitude,
            longitude,
            month,
            extract('hour' from created_at) as hour,
            extract('dow' from created_at) as day_of_week,
            created_at
            """
        )
        .order("created_at", desc=False)
        .limit(2500)
        .execute()
    )
    if result.error:
        raise RuntimeError(result.error.message)
    return {
        "sample_count": len(result.data or []),
        "features": ["crime_type", "context", "location", "month", "hour", "day_of_week", "latitude", "longitude"],
        "records": result.data or [],
        "note": "Use `month`, `hour`, `day_of_week`, and coordinates as inputs plus existing `crime_type` target for sequential prediction."
    }


@router.get("/predicted-hotspots")
def predicted_hotspots(_: str | None = Depends(allow_public_read("events.read"))):
    supabase = get_supabase()
    result = (
        supabase.table("crime_events")
        .select("location, latitude, longitude, context, crime_type, month, created_at")
        .order("created_at", desc=False)
        .execute()
    )
    if result.error:
        raise RuntimeError(result.error.message)

    records = result.data or []
    score_map: dict[str, int] = {}
    location_map: dict[str, dict[str, Any]] = {}
    for row in records:
        key = (row.get("location") or row.get("crime_type") or "Unknown").strip().lower()
        score_map[key] = score_map.get(key, 0) + 1
        if key not in location_map:
            location_map[key] = {
                "label": row.get("location") or row.get("crime_type") or "Unknown",
                "latitude": row.get("latitude"),
                "longitude": row.get("longitude"),
                "context": row.get("context"),
                "last_reported": row.get("created_at"),
                "count": 0,
            }
        location_map[key]["count"] = score_map[key]

    hotspots = sorted(location_map.values(), key=lambda h: h["count"], reverse=True)[:5]
    return {
        "hotspots": hotspots,
        "note": "Counts are used as a proxy score; treat them as signals for further model-driven planning.",
    }
