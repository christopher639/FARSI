from __future__ import annotations

from fastapi import APIRouter, Depends

from ..config import settings
from ..deps import require_permission
from ..supabase_client import get_supabase

router = APIRouter(prefix="/compliance", tags=["compliance"])


def _get_setting(supabase, key: str, default):
    result = supabase.table("system_settings").select("setting_value").eq("setting_key", key).limit(1).execute()
    if result.data:
        return result.data[0].get("setting_value", default)
    return default


@router.get("/status")
def compliance_status(_: str = Depends(require_permission("audit.read"))):
    supabase = get_supabase()
    audit_events = supabase.table("audit_logs").select("id", count="exact").execute()
    active_agencies = (
        supabase.table("connected_agencies")
        .select("id,status", count="exact")
        .eq("status", "active")
        .execute()
    )
    onboarding = _get_setting(supabase, "agency_onboarding_registry", [])
    federated_rounds = _get_setting(supabase, "federated_rounds", [])
    federated_clients = _get_setting(supabase, "federated_clients", [])

    completed_onboarding = len([x for x in onboarding if x.get("status") == "completed"])
    compliance_controls = {
        "audit_logging_enabled": True,
        "data_anonymization_enabled": settings.enable_data_anonymization,
        "read_response_anonymization_enabled": settings.anonymize_read_responses,
        "federated_learning_enabled": settings.federated_enabled,
        "federated_clients_registered": len(federated_clients),
    }
    readiness = {
        "audit_coverage": "ready" if (audit_events.count or 0) > 0 else "incomplete",
        "privacy_controls": "ready" if settings.enable_data_anonymization else "incomplete",
        "federated_learning": "ready" if settings.federated_enabled and len(federated_clients) >= settings.federated_min_clients else "incomplete",
        "multi_agency_onboarding": "ready" if completed_onboarding >= 1 else "incomplete",
        "national_scaling": "ready"
        if (active_agencies.count or 0) >= 2 and len(federated_clients) >= settings.federated_min_clients
        else "incomplete",
    }
    return {
        "controls": compliance_controls,
        "metrics": {
            "audit_events": audit_events.count or 0,
            "active_agencies": active_agencies.count or 0,
            "completed_onboarding": completed_onboarding,
            "federated_rounds": len(federated_rounds),
        },
        "readiness": readiness,
    }
