from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any


def _to_float(value: float | int | str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _entity_type_for(label: str) -> str:
    lowered = label.lower()
    if lowered.startswith("ip:"):
        return "infrastructure"
    if lowered.startswith("vehicle:"):
        return "vehicle"
    if lowered.startswith("location:"):
        return "location"
    if lowered.startswith("agency:"):
        return "organization"
    return "person"


def _node_key(node: dict[str, Any]) -> str | None:
    node_id = node.get("id")
    if isinstance(node_id, str) and node_id:
        return node_id
    label = node.get("label")
    if isinstance(label, str) and label:
        return label
    return None


def build_graph_rows(
    network_rows: list[dict[str, Any]],
    event_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    nodes_by_label: dict[str, dict[str, Any]] = {}
    edges_by_key: dict[tuple[str, str, str], dict[str, Any]] = {}
    now = datetime.now(timezone.utc).isoformat()

    def ensure_node(label: str, entity_type: str | None = None) -> dict[str, Any]:
        existing = nodes_by_label.get(label)
        if existing:
            return existing
        node = {
            "label": label,
            "entity_type": entity_type or _entity_type_for(label),
            "properties": {"threat_score": 0.0, "event_count": 0},
            "created_at": now,
        }
        nodes_by_label[label] = node
        return node

    def add_edge(source_label: str, target_label: str, relationship: str, weight: float = 1.0) -> None:
        if source_label == target_label:
            return
        source = ensure_node(source_label)
        target = ensure_node(target_label)
        source_id = source["label"]
        target_id = target["label"]
        key = (source_id, target_id, relationship)
        existing = edges_by_key.get(key)
        if existing:
            props = existing.setdefault("properties", {})
            props["weight"] = float(props.get("weight", 0.0)) + weight
            return
        edges_by_key[key] = {
            "source_id": source_id,
            "target_id": target_id,
            "relationship": relationship,
            "properties": {"weight": weight},
            "created_at": now,
        }

    for row in network_rows:
        src = (row.get("source_ip") or "").strip()
        dst = (row.get("destination_ip") or "").strip()
        if not src or not dst:
            continue
        src_label = f"ip:{src}"
        dst_label = f"ip:{dst}"
        protocol = (row.get("protocol") or "flow").lower()
        threat_detected = bool(row.get("threat_detected"))
        threat_weight = 2.0 if threat_detected else 1.0
        add_edge(src_label, dst_label, f"network_{protocol}", threat_weight)
        if threat_detected:
            ensure_node(src_label)["properties"]["threat_score"] += 0.6
            ensure_node(dst_label)["properties"]["threat_score"] += 0.6

    for row in event_rows:
        location = (row.get("location") or "").strip()
        location_label = f"location:{location}" if location else "location:unknown"
        ensure_node(location_label, "location")
        created_at = _parse_iso(row.get("created_at"))
        age_days = max((datetime.now(timezone.utc) - created_at).total_seconds() / 86400, 0.0) if created_at else 60.0
        recency_weight = math.exp(-(age_days / 30))
        severity = float(row.get("severity_score") or 0.5)

        entities = row.get("entities") or []
        if isinstance(entities, list):
            for idx, ent in enumerate(entities):
                if not isinstance(ent, dict):
                    continue
                raw_name = str(ent.get("value") or ent.get("text") or ent.get("name") or f"entity_{idx}").strip()
                if not raw_name:
                    continue
                ent_type = str(ent.get("type") or ent.get("entity_type") or "person").lower()
                prefix = "vehicle" if "vehicle" in ent_type else ent_type
                entity_label = f"{prefix}:{raw_name}"
                ensure_node(entity_label, "vehicle" if prefix == "vehicle" else "person")
                add_edge(entity_label, location_label, "seen_at", 1.0 + recency_weight)
                ensure_node(entity_label)["properties"]["threat_score"] += 0.3 * recency_weight * severity
                ensure_node(entity_label)["properties"]["event_count"] += 1

        title = (row.get("title") or "").lower()
        description = (row.get("description") or "").lower()
        if "vehicle" in title or "vehicle" in description:
            vehicle_node = ensure_node("vehicle:unknown", "vehicle")
            add_edge(vehicle_node["label"], location_label, "possibly_seen_at", 0.4 + recency_weight)
            vehicle_node["properties"]["threat_score"] += 0.15 * recency_weight

    nodes = list(nodes_by_label.values())
    edges = list(edges_by_key.values())
    return nodes, edges


def hidden_connections(nodes: list[dict[str, Any]], edges: list[dict[str, Any]], min_common_neighbors: int = 2) -> list[dict[str, Any]]:
    neighbors: dict[str, set[str]] = defaultdict(set)
    connected: set[tuple[str, str]] = set()

    for edge in edges:
        s = edge.get("source_id")
        t = edge.get("target_id")
        if not s or not t:
            continue
        neighbors[s].add(t)
        neighbors[t].add(s)
        connected.add((s, t))
        connected.add((t, s))

    node_ids = [_node_key(n) for n in nodes]
    node_ids = [n for n in node_ids if isinstance(n, str)]
    hints: list[dict[str, Any]] = []
    for i, a in enumerate(node_ids):
        for b in node_ids[i + 1 :]:
            if (a, b) in connected:
                continue
            common = neighbors[a] & neighbors[b]
            if len(common) < min_common_neighbors:
                continue
            union = neighbors[a] | neighbors[b]
            jaccard = len(common) / len(union) if union else 0.0
            if jaccard < 0.25:
                continue
            hints.append(
                {
                    "source_id": a,
                    "target_id": b,
                    "common_neighbors": sorted(common)[:6],
                    "score": round(jaccard, 3),
                    "connection_type": "shared-associates",
                }
            )
    hints.sort(key=lambda h: h["score"], reverse=True)
    return hints[:100]


def run_gnn_risk_scoring(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    *,
    iterations: int = 3,
    alpha: float = 0.55,
) -> dict[str, Any]:
    node_ids = [_node_key(n) for n in nodes]
    node_ids = [n for n in node_ids if isinstance(n, str)]
    neighbors: dict[str, set[str]] = defaultdict(set)
    for edge in edges:
        s = edge.get("source_id")
        t = edge.get("target_id")
        if isinstance(s, str) and isinstance(t, str):
            neighbors[s].add(t)
            neighbors[t].add(s)

    base: dict[str, float] = {}
    for node in nodes:
        node_id = _node_key(node)
        if node_id is None:
            continue
        props = node.get("properties") or node.get("metadata") or {}
        base_score = float(props.get("threat_score", 0.0))
        event_count = float(props.get("event_count", 0.0))
        base[node_id] = min(1.0, 0.3 * base_score + 0.07 * event_count)

    risk = dict(base)
    for _ in range(iterations):
        nxt = {}
        for node_id in node_ids:
            nbrs = list(neighbors[node_id])
            neigh_mean = sum(risk.get(n, 0.0) for n in nbrs) / len(nbrs) if nbrs else 0.0
            nxt[node_id] = max(0.0, min(1.0, alpha * base.get(node_id, 0.0) + (1 - alpha) * neigh_mean))
        risk = nxt

    top_entities = sorted(
        [{"id": node_id, "risk": score} for node_id, score in risk.items()],
        key=lambda item: item["risk"],
        reverse=True,
    )[:50]
    return {"risk_by_node": risk, "top_entities": top_entities, "model": "graph-message-passing-v1"}


def predictive_heatmap_from_events(
    crime_rows: list[dict[str, Any]],
    graph_risk: dict[str, float],
    *,
    horizon_days: int = 7,
) -> list[dict[str, Any]]:
    now = datetime.now(timezone.utc)
    recent_threshold = now - timedelta(days=14)
    prior_threshold = now - timedelta(days=28)

    grouped: dict[str, dict[str, Any]] = {}
    for row in crime_rows:
        lat = _to_float(row.get("latitude"))
        lon = _to_float(row.get("longitude"))
        if lat is None or lon is None:
            continue
        area = (row.get("area_name") or row.get("location") or "Unknown").split(",")[0].strip() or "Unknown"
        created_at = _parse_iso(row.get("created_at"))
        event_time = created_at or (now - timedelta(days=60))
        label = f"location:{area.lower()}"

        entry = grouped.get(area)
        if entry is None:
            entry = {
                "area": area,
                "lat_sum": 0.0,
                "lon_sum": 0.0,
                "count": 0,
                "severity_sum": 0.0,
                "recent": 0,
                "prior": 0,
                "graph_risk_sum": 0.0,
                "open_cases": 0,
            }
            grouped[area] = entry

        severity = float(row.get("severity_score") or 0.6)
        entry["lat_sum"] += lat
        entry["lon_sum"] += lon
        entry["count"] += 1
        entry["severity_sum"] += severity
        entry["graph_risk_sum"] += graph_risk.get(label, 0.0)
        if event_time >= recent_threshold:
            entry["recent"] += 1
        elif event_time >= prior_threshold:
            entry["prior"] += 1

        outcome = str(row.get("last_outcome_category") or "").lower()
        if "open" in outcome or "under investigation" in outcome or "awaiting" in outcome:
            entry["open_cases"] += 1

    if not grouped:
        return []

    max_count = max(v["count"] for v in grouped.values())
    results = []
    for area, v in grouped.items():
        count = v["count"]
        trend = (v["recent"] + 1) / (v["prior"] + 1)
        trend_score = min(max((trend - 1) / 2, 0.0), 1.0)
        frequency = count / max(max_count, 1)
        severity_score = (v["severity_sum"] / count) if count else 0.0
        unresolved = (v["open_cases"] / count) if count else 0.0
        graph_boost = (v["graph_risk_sum"] / count) if count else 0.0

        risk_score = 100 * (
            0.35 * frequency
            + 0.20 * trend_score
            + 0.20 * severity_score
            + 0.15 * unresolved
            + 0.10 * graph_boost
        )

        tier = "LOW"
        if risk_score >= 75:
            tier = "CRITICAL"
        elif risk_score >= 55:
            tier = "HIGH"
        elif risk_score >= 35:
            tier = "MEDIUM"

        results.append(
            {
                "label": area,
                "latitude": v["lat_sum"] / count,
                "longitude": v["lon_sum"] / count,
                "risk_score": risk_score,
                "tier": tier,
                "attack_probability": 1 / (1 + math.exp(-(risk_score - 50) / 10)),
                "recent_incidents": v["recent"],
                "prior_incidents": v["prior"],
                "trend_ratio": trend,
                "severity_score": severity_score,
                "unresolved_rate": unresolved,
                "graph_risk_boost": graph_boost,
                "prediction_window_start": now.isoformat(),
                "prediction_window_end": (now + timedelta(days=horizon_days)).isoformat(),
            }
        )

    results.sort(key=lambda item: item["risk_score"], reverse=True)
    return results[:25]
