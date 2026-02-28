from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..audit_utils import log_audit_event
from ..deps import allow_public_read, require_permission
from ..models import AgencyCreate, AgencyOut
from ..config import settings
from ..supabase_client import get_supabase


router = APIRouter(prefix="/agencies", tags=["agencies"])


class AgencyConnectRequest(BaseModel):
    source_system: str = "agency_system_connector"
    dataset_version: str | None = None
    run_training: bool = True
    run_prediction: bool = True


class AgencyOnboardingRequest(BaseModel):
    source_system: str = "agency_onboarding_portal"
    dataset_version: str | None = None
    legal_basis: str = "national_security_mandate"
    data_retention_days: int = 365
    enable_federated_learning: bool = True
    run_security_assessment: bool = True


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


def _to_out(doc: dict[str, Any]) -> AgencyOut:
    return AgencyOut(
        id=doc["id"],
        name=doc["name"],
        code=doc["code"],
        description=doc.get("description"),
        status=doc.get("status", "pending"),
        contact_person=doc.get("contact_person"),
        contact_email=doc.get("contact_email"),
        contact_phone=doc.get("contact_phone"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


@router.get("", response_model=list[AgencyOut])
def list_agencies(_: str | None = Depends(allow_public_read("agencies.read"))):
    supabase = get_supabase()
    result = supabase.table("connected_agencies").select("*").order("updated_at", desc=True).execute()
    return [_to_out(a) for a in (result.data or [])]


@router.get("/onboarding/template", response_model=dict)
def onboarding_template(_: str | None = Depends(allow_public_read("agencies.read"))):
    return {
        "required_documents": [
            "Data sharing MoU",
            "DPIA (Data Protection Impact Assessment)",
            "Security architecture checklist",
            "Incident response contacts",
        ],
        "technical_controls": [
            "TLS in transit",
            "Encryption at rest",
            "Role-based access control",
            "Audit-log forwarding",
            "PII anonymization policy",
        ],
        "integration_steps": [
            "agency_profile",
            "schema_mapping",
            "security_assessment",
            "pilot_ingestion",
            "federated_learning_registration",
            "production_cutover",
        ],
    }


@router.get("/onboarding", response_model=list[dict])
def list_onboarding(_: str | None = Depends(allow_public_read("agencies.read"))):
    supabase = get_supabase()
    return _get_setting(supabase, "agency_onboarding_registry", [])


@router.post("", response_model=AgencyOut)
def create_agency(payload: AgencyCreate, role: str = Depends(require_permission("agencies.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    doc.update({"created_at": now, "updated_at": now})
    created = supabase.table("connected_agencies").insert(doc).execute().data[0]
    log_audit_event(action="agencies.create", target=created["id"], role=role, metadata={"code": doc["code"]})
    return _to_out(created)


@router.put("/{agency_id}", response_model=AgencyOut)
def update_agency(agency_id: str, payload: AgencyCreate, role: str = Depends(require_permission("agencies.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    update = payload.model_dump()
    update["updated_at"] = now
    result = supabase.table("connected_agencies").update(update).eq("id", agency_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agency_not_found")
    log_audit_event(action="agencies.update", target=agency_id, role=role, metadata={"code": update["code"]})
    return _to_out(result.data[0])


@router.delete("/{agency_id}")
def delete_agency(agency_id: str, role: str = Depends(require_permission("agencies.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    result = supabase.table("connected_agencies").delete().eq("id", agency_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agency_not_found")
    log_audit_event(action="agencies.delete", target=agency_id, role=role, metadata={})
    return {"status": "deleted"}


@router.post("/{agency_id}/onboarding/initiate")
def initiate_onboarding(
    agency_id: str,
    payload: AgencyOnboardingRequest,
    role: str = Depends(require_permission("agencies.write")),
):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    existing = supabase.table("connected_agencies").select("*").eq("id", agency_id).limit(1).execute().data or []
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agency_not_found")
    agency = existing[0]

    plan = {
        "agency_id": agency_id,
        "agency_name": agency["name"],
        "agency_code": agency["code"],
        "status": "in_progress",
        "started_at": now,
        "source_system": payload.source_system,
        "dataset_version": payload.dataset_version,
        "legal_basis": payload.legal_basis,
        "data_retention_days": payload.data_retention_days,
        "enable_federated_learning": payload.enable_federated_learning and settings.federated_enabled,
        "run_security_assessment": payload.run_security_assessment,
        "checklist": [
            {"step": "Data sharing agreement", "status": "pending"},
            {"step": "Security controls verification", "status": "pending"},
            {"step": "Schema mapping", "status": "pending"},
            {"step": "Pilot data ingestion", "status": "pending"},
            {"step": "Operational sign-off", "status": "pending"},
        ],
    }

    registry = _get_setting(supabase, "agency_onboarding_registry", [])
    registry = [entry for entry in registry if entry.get("agency_id") != agency_id]
    registry.append(plan)
    _set_setting(supabase, "agency_onboarding_registry", registry, updated_by=role)

    supabase.table("connected_agencies").update({"status": "pending", "updated_at": now}).eq("id", agency_id).execute()
    log_audit_event(
        action="agencies.onboarding.initiate",
        target=agency_id,
        role=role,
        metadata={"source_system": payload.source_system, "federated_learning": plan["enable_federated_learning"]},
    )
    return {"status": "initiated", "onboarding": plan}


@router.post("/{agency_id}/onboarding/complete")
def complete_onboarding(agency_id: str, role: str = Depends(require_permission("agencies.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    existing = supabase.table("connected_agencies").select("*").eq("id", agency_id).limit(1).execute().data or []
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agency_not_found")

    registry = _get_setting(supabase, "agency_onboarding_registry", [])
    updated_registry = []
    matched_plan = None
    for entry in registry:
        if entry.get("agency_id") == agency_id:
            entry = dict(entry)
            entry["status"] = "completed"
            entry["completed_at"] = now
            checklist = []
            for step in entry.get("checklist", []):
                step = dict(step)
                step["status"] = "done"
                checklist.append(step)
            entry["checklist"] = checklist
            matched_plan = entry
        updated_registry.append(entry)
    _set_setting(supabase, "agency_onboarding_registry", updated_registry, updated_by=role)

    supabase.table("connected_agencies").update({"status": "active", "updated_at": now}).eq("id", agency_id).execute()

    log_audit_event(action="agencies.onboarding.complete", target=agency_id, role=role, metadata={"completed_at": now})
    return {"status": "completed", "onboarding": matched_plan}


@router.post("/{agency_id}/connect")
def connect_agency(
    agency_id: str,
    payload: AgencyConnectRequest,
    role: str = Depends(require_permission("agencies.write")),
):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    existing = supabase.table("connected_agencies").select("*").eq("id", agency_id).limit(1).execute().data or []
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agency_not_found")
    agency = existing[0]

    update = supabase.table("connected_agencies").update({"status": "active", "updated_at": now}).eq("id", agency_id).execute()
    updated = update.data[0] if update.data else agency

    pipeline_steps = [
        "schema_alignment",
        "data_cleaning",
        "feature_engineering",
        "data_transformation",
    ]
    if payload.run_training:
        pipeline_steps.append("ml_training_queued")
    if payload.run_prediction:
        pipeline_steps.append("prediction_queued")

    event_doc = {
        "event_type": "agency_connection_pipeline",
        "title": f"Agency connected: {agency['name']}",
        "description": (
            f"{agency['name']} ({agency['code']}) connected to Data Fusion Hub. "
            "Inbound feeds are now routed through cleaning, feature engineering, transformation, "
            "model training queue, and prediction queue."
        ),
        "modality": "structured",
        "provenance": {
            "source_system": payload.source_system,
            "source_agency": agency["name"],
            "ingested_at": now,
            "original_timestamp": None,
            "transformations": pipeline_steps,
            "model_version": None,
            "confidence": None,
            "chain_of_custody_id": None,
            "dataset_version": payload.dataset_version,
        },
        "created_at": now,
    }
    created_event = supabase.table("ingestion_events").insert(event_doc).execute().data[0]

    log_audit_event(
        action="agencies.connect",
        target=agency_id,
        role=role,
        metadata={
            "code": agency["code"],
            "source_system": payload.source_system,
            "run_training": payload.run_training,
            "run_prediction": payload.run_prediction,
            "pipeline_steps": pipeline_steps,
        },
    )

    return {
        "status": "connected",
        "agency": _to_out(updated).model_dump(mode="json"),
        "event_id": created_event["id"],
        "pipeline": {
            "stages": pipeline_steps,
            "training_queued": payload.run_training,
            "prediction_queued": payload.run_prediction,
        },
    }


@router.post("/{agency_id}/disconnect")
def disconnect_agency(agency_id: str, role: str = Depends(require_permission("agencies.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    existing = supabase.table("connected_agencies").select("*").eq("id", agency_id).limit(1).execute().data or []
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agency_not_found")
    agency = existing[0]

    update = supabase.table("connected_agencies").update({"status": "inactive", "updated_at": now}).eq("id", agency_id).execute()
    updated = update.data[0] if update.data else agency

    event_doc = {
        "event_type": "agency_disconnected",
        "title": f"Agency disconnected: {agency['name']}",
        "description": f"{agency['name']} ({agency['code']}) disconnected from Data Fusion Hub ingestion pipeline.",
        "modality": "structured",
        "provenance": {
            "source_system": "agency_system_connector",
            "source_agency": agency["name"],
            "ingested_at": now,
            "original_timestamp": None,
            "transformations": ["ingestion_paused"],
            "model_version": None,
            "confidence": None,
            "chain_of_custody_id": None,
            "dataset_version": None,
        },
        "created_at": now,
    }
    created_event = supabase.table("ingestion_events").insert(event_doc).execute().data[0]

    log_audit_event(action="agencies.disconnect", target=agency_id, role=role, metadata={"code": agency["code"]})

    return {
        "status": "disconnected",
        "agency": _to_out(updated).model_dump(mode="json"),
        "event_id": created_event["id"],
    }
