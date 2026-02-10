from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..deps import allow_public_read, require_permission
from ..models import AgencyCreate, AgencyOut
from ..supabase_client import get_supabase


router = APIRouter(prefix="/agencies", tags=["agencies"])


class AgencyConnectRequest(BaseModel):
    source_system: str = "agency_system_connector"
    dataset_version: str | None = None
    run_training: bool = True
    run_prediction: bool = True


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


@router.post("", response_model=AgencyOut)
def create_agency(payload: AgencyCreate, role: str = Depends(require_permission("agencies.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    doc = payload.model_dump()
    doc.update({"created_at": now, "updated_at": now})
    created = supabase.table("connected_agencies").insert(doc).execute().data[0]
    supabase.table("audit_logs").insert(
        {
            "actor": "api",
            "role": role,
            "action": "agencies.create",
            "target": created["id"],
            "metadata": {"code": doc["code"]},
            "created_at": now,
        }
    ).execute()
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
    supabase.table("audit_logs").insert(
        {
            "actor": "api",
            "role": role,
            "action": "agencies.update",
            "target": agency_id,
            "metadata": {"code": update["code"]},
            "created_at": now,
        }
    ).execute()
    return _to_out(result.data[0])


@router.delete("/{agency_id}")
def delete_agency(agency_id: str, role: str = Depends(require_permission("agencies.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    result = supabase.table("connected_agencies").delete().eq("id", agency_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="agency_not_found")
    supabase.table("audit_logs").insert(
        {
            "actor": "api",
            "role": role,
            "action": "agencies.delete",
            "target": agency_id,
            "metadata": {},
            "created_at": now,
        }
    ).execute()
    return {"status": "deleted"}


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

    supabase.table("audit_logs").insert(
        {
            "actor": "api",
            "role": role,
            "action": "agencies.connect",
            "target": agency_id,
            "metadata": {
                "code": agency["code"],
                "source_system": payload.source_system,
                "run_training": payload.run_training,
                "run_prediction": payload.run_prediction,
                "pipeline_steps": pipeline_steps,
            },
            "created_at": now,
        }
    ).execute()

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

    supabase.table("audit_logs").insert(
        {
            "actor": "api",
            "role": role,
            "action": "agencies.disconnect",
            "target": agency_id,
            "metadata": {"code": agency["code"]},
            "created_at": now,
        }
    ).execute()

    return {
        "status": "disconnected",
        "agency": _to_out(updated).model_dump(mode="json"),
        "event_id": created_event["id"],
    }
