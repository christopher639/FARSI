from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..audit_utils import log_audit_event
from ..config import settings
from ..deps import allow_public_read, require_permission
from ..supabase_client import get_supabase

router = APIRouter(prefix="/federated", tags=["federated"])


class FederatedClientRegistration(BaseModel):
    agency_id: str
    endpoint: str
    public_key_fingerprint: str
    data_modalities: list[str] = Field(default_factory=list)
    min_samples: int = 100


class StartFederatedRoundRequest(BaseModel):
    model_name: str
    base_model_version: str = "v1"
    min_participants: int = 2
    target_agencies: list[str] = Field(default_factory=list)


class SubmitFederatedUpdateRequest(BaseModel):
    agency_id: str
    sample_count: int = Field(..., ge=1)
    update_hash: str
    metrics: dict[str, float] = Field(default_factory=dict)
    delta_norm: float | None = None


def _get_setting(supabase, key: str, default: Any):
    result = supabase.table("system_settings").select("setting_value").eq("setting_key", key).limit(1).execute()
    if result.data:
        return result.data[0].get("setting_value", default)
    return default


def _set_setting(supabase, key: str, value: Any, updated_by: str | None) -> None:
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("system_settings").upsert(
        {
            "setting_key": key,
            "setting_value": value,
            "description": "Auto-managed by FARSI backend",
            "updated_at": now,
            "updated_by": updated_by,
        },
        on_conflict="setting_key",
    ).execute()


def _assert_enabled() -> None:
    if not settings.federated_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="federated_learning_disabled")


@router.get("/clients")
def list_clients(_: str | None = Depends(allow_public_read("models.read"))):
    _assert_enabled()
    supabase = get_supabase()
    return _get_setting(supabase, "federated_clients", [])


@router.post("/clients/register")
def register_client(payload: FederatedClientRegistration, role: str = Depends(require_permission("agencies.write"))):
    _assert_enabled()
    supabase = get_supabase()
    clients = _get_setting(supabase, "federated_clients", [])
    clients = [c for c in clients if c.get("agency_id") != payload.agency_id]
    client_doc = payload.model_dump()
    client_doc["registered_at"] = datetime.now(timezone.utc).isoformat()
    clients.append(client_doc)
    _set_setting(supabase, "federated_clients", clients, updated_by=role)
    log_audit_event(
        action="federated.client.register",
        target=payload.agency_id,
        role=role,
        metadata={"endpoint": payload.endpoint, "modalities": payload.data_modalities},
    )
    return {"status": "registered", "client": client_doc}


@router.get("/rounds")
def list_rounds(_: str | None = Depends(allow_public_read("models.read"))):
    _assert_enabled()
    supabase = get_supabase()
    return _get_setting(supabase, "federated_rounds", [])


@router.post("/rounds/start")
def start_round(payload: StartFederatedRoundRequest, role: str = Depends(require_permission("models.write"))):
    _assert_enabled()
    supabase = get_supabase()
    clients = _get_setting(supabase, "federated_clients", [])
    if len(clients) < max(payload.min_participants, settings.federated_min_clients):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="insufficient_registered_clients")

    now = datetime.now(timezone.utc).isoformat()
    round_id = str(uuid.uuid4())
    round_doc = {
        "id": round_id,
        "model_name": payload.model_name,
        "base_model_version": payload.base_model_version,
        "status": "active",
        "created_at": now,
        "created_by_role": role,
        "min_participants": max(payload.min_participants, settings.federated_min_clients),
        "target_agencies": payload.target_agencies or [c.get("agency_id") for c in clients],
        "updates": [],
        "aggregate": None,
    }
    rounds = _get_setting(supabase, "federated_rounds", [])
    rounds.append(round_doc)
    _set_setting(supabase, "federated_rounds", rounds, updated_by=role)

    log_audit_event(action="federated.round.start", target=round_id, role=role, metadata={"model_name": payload.model_name})
    return {"status": "started", "round": round_doc}


@router.post("/rounds/{round_id}/submit")
def submit_update(
    round_id: str,
    payload: SubmitFederatedUpdateRequest,
    role: str = Depends(require_permission("agencies.write")),
):
    _assert_enabled()
    supabase = get_supabase()
    rounds = _get_setting(supabase, "federated_rounds", [])
    found = None
    for idx, row in enumerate(rounds):
        if row.get("id") == round_id:
            found = idx
            break
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="round_not_found")

    round_doc = dict(rounds[found])
    if round_doc.get("status") != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="round_not_active")

    updates = [u for u in round_doc.get("updates", []) if u.get("agency_id") != payload.agency_id]
    updates.append(
        {
            "agency_id": payload.agency_id,
            "sample_count": payload.sample_count,
            "update_hash": payload.update_hash,
            "metrics": payload.metrics,
            "delta_norm": payload.delta_norm,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    round_doc["updates"] = updates
    rounds[found] = round_doc
    _set_setting(supabase, "federated_rounds", rounds, updated_by=role)
    log_audit_event(
        action="federated.round.submit",
        target=round_id,
        role=role,
        metadata={"agency_id": payload.agency_id, "sample_count": payload.sample_count},
    )
    return {"status": "accepted", "round_id": round_id, "update_count": len(updates)}


@router.post("/rounds/{round_id}/aggregate")
def aggregate_round(round_id: str, role: str = Depends(require_permission("models.write"))):
    _assert_enabled()
    supabase = get_supabase()
    rounds = _get_setting(supabase, "federated_rounds", [])
    found = None
    for idx, row in enumerate(rounds):
        if row.get("id") == round_id:
            found = idx
            break
    if found is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="round_not_found")

    round_doc = dict(rounds[found])
    updates = round_doc.get("updates", [])
    min_participants = int(round_doc.get("min_participants", settings.federated_min_clients))
    if len(updates) < min_participants:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="not_enough_updates")

    total_samples = sum(int(u.get("sample_count", 0)) for u in updates)
    weighted_metrics: dict[str, float] = {}
    metric_weights: dict[str, float] = {}
    for update in updates:
        weight = int(update.get("sample_count", 0))
        for key, value in (update.get("metrics") or {}).items():
            weighted_metrics[key] = weighted_metrics.get(key, 0.0) + (float(value) * weight)
            metric_weights[key] = metric_weights.get(key, 0.0) + weight

    averaged_metrics = {
        key: (weighted_metrics[key] / metric_weights[key]) if metric_weights.get(key) else 0.0
        for key in weighted_metrics.keys()
    }
    aggregate = {
        "total_samples": total_samples,
        "participant_count": len(updates),
        "metrics": averaged_metrics,
        "aggregated_at": datetime.now(timezone.utc).isoformat(),
        "global_model_version": f"{round_doc.get('base_model_version', 'v1')}-fed-{len(updates)}",
    }

    round_doc["status"] = "aggregated"
    round_doc["aggregate"] = aggregate
    rounds[found] = round_doc
    _set_setting(supabase, "federated_rounds", rounds, updated_by=role)

    log_audit_event(
        action="federated.round.aggregate",
        target=round_id,
        role=role,
        metadata={"participants": len(updates), "total_samples": total_samples},
    )
    return {"status": "aggregated", "round_id": round_id, "aggregate": aggregate}
