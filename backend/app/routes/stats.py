from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from ..deps import allow_public_read
from ..supabase_client import get_supabase


router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/dashboard")
def dashboard_stats(_: str | None = Depends(allow_public_read("reports.read"))):
    supabase = get_supabase()
    active_threats = (
        supabase.table("threat_alerts")
        .select("*", count="exact")
        .in_("status", ["new", "investigating"])
        .execute()
    )
    critical_zones = (
        supabase.table("threat_alerts")
        .select("*", count="exact")
        .eq("severity", "critical")
        .in_("status", ["new", "investigating"])
        .execute()
    )
    entities_tracked = supabase.table("profiles").select("*", count="exact").execute()
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_entities = supabase.table("profiles").select("*", count="exact").gte("created_at", week_ago.isoformat()).execute()
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    reports_today = supabase.table("intelligence_reports").select("*", count="exact").gte("created_at", today.isoformat()).execute()
    agencies = supabase.table("connected_agencies").select("status").execute()

    agencies_data = agencies.data or []
    active_agencies = len([a for a in agencies_data if a.get("status") == "active"])
    total_agencies = len(agencies_data)

    return {
        "activeThreats": active_threats.count or 0,
        "criticalZones": critical_zones.count or 0,
        "entitiesTracked": entities_tracked.count or 0,
        "newEntitiesThisWeek": new_entities.count or 0,
        "reportsToday": reports_today.count or 0,
        "activeOperations": active_threats.count or 0,
        "agenciesOnline": active_agencies,
        "totalAgencies": total_agencies,
    }
