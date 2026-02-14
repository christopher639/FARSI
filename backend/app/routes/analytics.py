from datetime import datetime, timezone
from typing import Any
from typing import Any

from ..deps import allow_public_read
from ..deps import require_permission
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


@router.post("/refresh-hotspots")
def refresh_hotspots(_: str = Depends(require_permission("heatmap.write"))):
    supabase = get_supabase()
    # Aggregate recent crime counts per grid cell
    agg = (
        supabase.table("crime_events")
        .select("latitude, longitude, location, crime_type")
        .neq("latitude", None)
        .neq("longitude", None)
        .order("created_at", desc=True)
        .limit(2000)
        .execute()
    )
    if agg.error:
        raise RuntimeError(agg.error.message)

    counts: dict[str, dict[str, Any]] = {}
    for row in agg.data or []:
        key = f"{row.get('latitude'):.4f}-{row.get('longitude'):.4f}"
        counts.setdefault(key, {
            "lat": row.get("latitude"),
            "lon": row.get("longitude"),
            "score": 0,
            "label": row.get("location") or row.get("crime_type") or "Unknown",
        })["score"] += 1

    cells = sorted(counts.values(), key=lambda x: x["score"], reverse=True)[:10]
    payload = []
    now = datetime.now(timezone.utc).isoformat()
    for cell in cells:
        payload.append({
            "lat": cell["lat"],
            "lon": cell["lon"],
            "score": float(cell["score"]),
            "window_start": now,
            "window_end": now,
        })

    response = supabase.table("threat_heatmap_cells").upsert(payload).execute()
    if response.error:
        raise RuntimeError(response.error.message)

    return {
        "updated": len(payload),
        "note": "Top 10 locations upserted into threat_heatmap_cells for visualizations.",
    }
