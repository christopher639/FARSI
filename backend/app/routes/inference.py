from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, File, Form, UploadFile

from ..deps import require_permission
from ..ml.cv import run_object_detection
from ..ml.heatmap import generate_heatmap_cells
from ..ml.nlp import run_nlp
from ..supabase_client import get_supabase


router = APIRouter(prefix="/inference", tags=["inference"])


def _get_or_create_model(name: str, version: str, model_type: str, framework: str):
    supabase = get_supabase()
    result = (
        supabase.table("ml_models")
        .upsert(
            {"name": name, "version": version, "model_type": model_type, "framework": framework},
            on_conflict="name,version",
        )
        .execute()
    )
    if result.data:
        return result.data[0]
    existing = (
        supabase.table("ml_models").select("*").eq("name", name).eq("version", version).limit(1).execute().data
        or []
    )
    return existing[0]


@router.post("/nlp")
def nlp_inference(
    text: str = Form(...),
    event_id: str | None = Form(None),
    _: str = Depends(require_permission("inference.write")),
):
    supabase = get_supabase()
    result = run_nlp(text)
    model = _get_or_create_model("multilingual-ner-link-sentiment", "v2", "nlp", "transformers")
    created = supabase.table("ml_inference_results").insert(
        {
            "event_id": event_id,
            "model_id": model["id"],
            "result": result,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    return {"result": result, "stored": created.data[0] if created.data else None}


@router.post("/cv")
def cv_inference(
    image: UploadFile = File(...),
    event_id: str | None = Form(None),
    _: str = Depends(require_permission("inference.write")),
):
    supabase = get_supabase()
    image_bytes = image.file.read()
    result = run_object_detection(image_bytes)
    model = _get_or_create_model("detr-object-detection", "v1", "cv", "transformers")
    created = supabase.table("ml_inference_results").insert(
        {
            "event_id": event_id,
            "model_id": model["id"],
            "result": result,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    return {"result": result, "stored": created.data[0] if created.data else None}


@router.post("/heatmap")
def heatmap_inference(
    window_hours: int = Form(24),
    limit: int = Form(10000),
    _: str = Depends(require_permission("heatmap.write")),
):
    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(hours=window_hours)

    records = []
    page_size = 1000
    offset = 0
    while True:
        batch = (
            supabase.table("crime_events")
            .select("latitude,longitude")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        data = batch.data or []
        if not data:
            break
        records.extend(data)
        offset += page_size
        if len(records) >= limit:
            records = records[:limit]
            break

    cells = generate_heatmap_cells(records, window_start, now)
    if cells:
        supabase.table("threat_heatmap_cells").insert(cells).execute()
    return {"count": len(cells)}
