from fastapi import APIRouter, Depends

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
