import csv
import io

from fastapi import APIRouter, Depends, Response

from ..deps import require_permission
from ..supabase_client import get_supabase


router = APIRouter(prefix="/export", tags=["export"])


@router.get("/crime-events")
def export_crime_events(limit: int = 10000, _: str = Depends(require_permission("events.read"))):
    supabase = get_supabase()
    result = supabase.table("crime_events").select("*").limit(limit).execute()
    rows = result.data or []

    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    content = output.getvalue()
    return Response(content=content, media_type="text/csv")
