from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from ..deps import get_current_user, allow_public_read, require_permission
from ..models import IntelligenceReportCreate, IntelligenceReportOut
from ..supabase_client import get_supabase


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", response_model=list[IntelligenceReportOut])
def list_reports(_: str | None = Depends(allow_public_read("reports.read"))):
    supabase = get_supabase()
    result = supabase.table("intelligence_reports").select("*").order("created_at", desc=True).execute()
    return result.data or []


@router.post("", response_model=IntelligenceReportOut)
def create_report(
    payload: IntelligenceReportCreate,
    user: dict | None = Depends(get_current_user),
    _: str = Depends(require_permission("reports.write")),
):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    created = supabase.table("intelligence_reports").insert(
        {
            **payload.model_dump(exclude={"author_id"}),
            "author_id": user["id"] if user else payload.author_id,
            "created_at": now,
            "updated_at": now,
        }
    ).execute()
    return created.data[0]


@router.put("/{report_id}", response_model=IntelligenceReportOut)
def update_report(report_id: str, payload: IntelligenceReportCreate, _: str = Depends(require_permission("reports.write"))):
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    updated = (
        supabase.table("intelligence_reports")
        .update({**payload.model_dump(), "updated_at": now})
        .eq("id", report_id)
        .execute()
    )
    return updated.data[0]


@router.delete("/{report_id}")
def delete_report(report_id: str, _: str = Depends(require_permission("reports.write"))):
    supabase = get_supabase()
    supabase.table("intelligence_reports").delete().eq("id", report_id).execute()
    return {"status": "deleted"}
