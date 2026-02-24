from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends

from ..deps import allow_public_read, require_permission
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


def _to_float(value: float | int | str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _severity_score(crime_type: str | None) -> float:
    if not crime_type:
        return 0.6
    return (CRIME_SEVERITY.get(crime_type.strip(), 3)) / 5


def _open_case_flag(last_outcome: str | None) -> float:
    if not last_outcome:
        return 0.5
    outcome = last_outcome.lower()
    if "under investigation" in outcome or "awaiting" in outcome or "open" in outcome:
        return 1.0
    if "unable to prosecute" in outcome or "no suspect" in outcome:
        return 0.75
    return 0.0


def _area_label(row: dict[str, Any]) -> str:
    area_name = (row.get("area_name") or "").strip()
    if area_name:
        return area_name
    location = (row.get("location") or "").strip()
    if location:
        return location.split(",")[0].strip() or location
    crime_type = (row.get("crime_type") or "").strip()
    return crime_type or "Unknown"


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
    recent_window_start = now - timedelta(days=14)
    prior_window_start = now - timedelta(days=28)
    horizon_end = now + timedelta(days=7)

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
        return {"hotspots": [], "model": "recency-trend-risk-v1", "horizon_days": 7}

    by_area: dict[str, dict[str, Any]] = {}
    for row in rows:
        lat = _to_float(row.get("latitude"))
        lon = _to_float(row.get("longitude"))
        created_at = _parse_datetime(row.get("created_at"))
        if lat is None or lon is None or created_at is None:
            continue

        label = _area_label(row)
        entry = by_area.get(label)
        if entry is None:
            entry = {
                "label": label,
                "lat_weighted_sum": 0.0,
                "lon_weighted_sum": 0.0,
                "weight_sum": 0.0,
                "severity_weighted_sum": 0.0,
                "open_weighted_sum": 0.0,
                "recent_incidents": 0,
                "prior_incidents": 0,
                "active_days": set(),
            }
            by_area[label] = entry

        age_days = max((now - created_at).total_seconds() / 86400, 0.0)
        recency_weight = math.exp(-(age_days / 30))
        severity = _severity_score(row.get("crime_type"))
        open_case = _open_case_flag(row.get("last_outcome_category"))

        entry["lat_weighted_sum"] += lat * recency_weight
        entry["lon_weighted_sum"] += lon * recency_weight
        entry["weight_sum"] += recency_weight
        entry["severity_weighted_sum"] += severity * recency_weight
        entry["open_weighted_sum"] += open_case * recency_weight
        entry["active_days"].add(created_at.date().isoformat())

        if created_at >= recent_window_start:
            entry["recent_incidents"] += 1
        elif created_at >= prior_window_start:
            entry["prior_incidents"] += 1

    if not by_area:
        return {"hotspots": [], "model": "recency-trend-risk-v1", "horizon_days": 7}

    max_weight = max(float(value["weight_sum"]) for value in by_area.values())
    max_weight = max(max_weight, 1.0)

    scored: list[dict[str, Any]] = []
    for value in by_area.values():
        weight_sum = float(value["weight_sum"])
        if weight_sum <= 0:
            continue

        frequency_score = min(weight_sum / max_weight, 1.0)
        severity_score = min(float(value["severity_weighted_sum"]) / weight_sum, 1.0)
        unresolved_rate = min(float(value["open_weighted_sum"]) / weight_sum, 1.0)

        recent = int(value["recent_incidents"])
        prior = int(value["prior_incidents"])
        trend_ratio = (recent + 1) / (prior + 1)
        trend_score = min(max((trend_ratio - 1) / 2, 0.0), 1.0)

        repeat_exposure = min(len(value["active_days"]) / 14, 1.0)

        risk_score = 100 * (
            0.35 * frequency_score
            + 0.20 * trend_score
            + 0.20 * severity_score
            + 0.15 * unresolved_rate
            + 0.10 * repeat_exposure
        )
        attack_probability = 1 / (1 + math.exp(-(risk_score - 50) / 9))

        tier = "LOW"
        if risk_score >= 75:
            tier = "CRITICAL"
        elif risk_score >= 55:
            tier = "HIGH"
        elif risk_score >= 35:
            tier = "MEDIUM"

        scored.append(
            {
                "label": value["label"],
                "latitude": float(value["lat_weighted_sum"]) / weight_sum,
                "longitude": float(value["lon_weighted_sum"]) / weight_sum,
                "risk_score": risk_score,
                "tier": tier,
                "attack_probability": attack_probability,
                "recent_incidents": recent,
                "prior_incidents": prior,
                "trend_ratio": trend_ratio,
                "severity_score": severity_score,
                "unresolved_rate": unresolved_rate,
                "repeat_exposure": repeat_exposure,
                "prediction_window_start": now.isoformat(),
                "prediction_window_end": horizon_end.isoformat(),
            }
        )

    hotspots = sorted(scored, key=lambda h: h["risk_score"], reverse=True)[:10]
    return {
        "hotspots": hotspots,
        "model": "recency-trend-risk-v1",
        "horizon_days": 7,
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
