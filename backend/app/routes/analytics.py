from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from ..deps import allow_public_read, require_permission
from ..ml.network_graph import predictive_heatmap_from_events, run_gnn_risk_scoring
from ..supabase_client import get_supabase

router = APIRouter(prefix="/analytics", tags=["analytics"])

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


def _severity_score(crime_type: str | None) -> float:
    if not crime_type:
        return 0.6
    return (CRIME_SEVERITY.get(crime_type.strip(), 3)) / 5


@router.get("/crime-patterns")
def crime_patterns(_: str | None = Depends(allow_public_read("events.read"))):
    supabase = get_supabase()
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
        "note": "Use month/hour/day-of-week/geolocation features for sequence prediction.",
    }


@router.get("/predicted-hotspots")
def predicted_hotspots(_: str | None = Depends(allow_public_read("events.read"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    horizon_days = 7

    result = (
        supabase.table("crime_events")
        .select(
            "area_name, location, latitude, longitude, context, crime_type, last_outcome_category, created_at"
        )
        .gte("created_at", (now - timedelta(days=180)).isoformat())
        .order("created_at", desc=False)
        .limit(10000)
        .execute()
    )
    if result.error:
        raise RuntimeError(result.error.message)

    rows = result.data or []
    if not rows:
        return {"hotspots": [], "model": "gnn-threat-fusion-v1", "horizon_days": horizon_days}

    node_rows = supabase.table("entity_nodes").select("id,label,entity_type,properties").limit(5000).execute().data or []
    edge_rows = supabase.table("entity_edges").select("source_id,target_id,relationship,properties").limit(8000).execute().data or []
    gnn = run_gnn_risk_scoring(node_rows, edge_rows)
    graph_risk = gnn.get("risk_by_node", {})

    enriched = []
    for row in rows:
        row = dict(row)
        row["severity_score"] = _severity_score(row.get("crime_type"))
        enriched.append(row)

    hotspots = predictive_heatmap_from_events(enriched, graph_risk, horizon_days=horizon_days)
    return {
        "hotspots": hotspots,
        "model": "gnn-threat-fusion-v1",
        "horizon_days": horizon_days,
        "graph_model": gnn.get("model"),
        "graph_top_entities": gnn.get("top_entities", [])[:10],
        "generated_at": now.isoformat(),
    }


@router.post("/refresh-hotspots")
def refresh_hotspots(_: str = Depends(require_permission("heatmap.write"))):
    supabase = get_supabase()
    prediction = predicted_hotspots(None)
    hotspots = prediction.get("hotspots", [])
    if not hotspots:
        return {"updated": 0, "note": "No hotspot prediction data available."}

    now = datetime.now(timezone.utc).isoformat()
    payload = [
        {
            "lat": item["latitude"],
            "lon": item["longitude"],
            "score": float(item["risk_score"]),
            "window_start": item.get("prediction_window_start", now),
            "window_end": item.get("prediction_window_end", now),
        }
        for item in hotspots
    ]

    response = supabase.table("threat_heatmap_cells").upsert(payload).execute()
    if response.error:
        raise RuntimeError(response.error.message)

    return {
        "updated": len(payload),
        "note": "Predicted vulnerable hotspots upserted into threat_heatmap_cells.",
        "model": prediction.get("model"),
    }
