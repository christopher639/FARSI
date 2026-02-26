from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from ..deps import require_permission
from ..ml.cv import run_object_detection
from ..ml.nlp import run_nlp
from ..supabase_client import get_supabase


router = APIRouter(prefix="/hooks", tags=["hooks"])


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


def _run_event_inference(event_id: str) -> None:
    supabase = get_supabase()
    event = (
        supabase.table("ingestion_events").select("*").eq("id", event_id).limit(1).execute().data or []
    )
    if not event:
        return
    event = event[0]
    now = datetime.now(timezone.utc).isoformat()
    modality = event.get("modality", "text")

    if modality in {"text", "report", "osint"}:
        text = f"{event.get('title')}\n{event.get('description')}".strip()
        if text:
            result = run_nlp(text)
            model = _get_or_create_model("multilingual-ner-link-sentiment", "v2", "nlp", "transformers")
            supabase.table("ml_inference_results").insert(
                {"event_id": event_id, "model_id": model["id"], "result": result, "created_at": now}
            ).execute()

    if modality in {"cctv", "image", "video"} and event.get("media_path"):
        media_path = event["media_path"]
        if "/" in media_path:
            bucket, path = media_path.split("/", 1)
        else:
            bucket, path = "ingestion-media", media_path
        file_bytes = supabase.storage.from_(bucket).download(path)
        result = run_object_detection(file_bytes)
        model = _get_or_create_model("detr-object-detection", "v1", "cv", "transformers")
        supabase.table("ml_inference_results").insert(
            {"event_id": event_id, "model_id": model["id"], "result": result, "created_at": now}
        ).execute()

    supabase.table("ingestion_events").update({"processed_at": now, "last_inference_at": now}).eq("id", event_id).execute()


@router.post("/ingestion")
def ingestion_hook(payload: dict, tasks: BackgroundTasks, _: str = Depends(require_permission("inference.write"))):
    event_id = payload.get("event_id")
    if not event_id:
        raise HTTPException(status_code=400, detail="event_id required")
    tasks.add_task(_run_event_inference, event_id)
    return {"status": "queued", "event_id": event_id}
