from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel

from ..deps import require_permission
from ..ml.cv import analyze_image, analyze_video
from ..ml.heatmap import generate_heatmap_cells
from ..ml.nlp import run_nlp
from ..supabase_client import get_supabase


router = APIRouter(prefix="/inference", tags=["inference"])


# ── fastai crime-type prediction ──

class CrimePredictRequest(BaseModel):
    latitude: float
    longitude: float
    month: str = "2025-11"
    falls_within: str = "Nairobi Metropolitan Regional Command"
    location: str = "Unknown"
    context: str = ""
    last_outcome_category: str | None = None


@router.post("/predict-crime")
def predict_crime_type(
    body: CrimePredictRequest,
    _: str = Depends(require_permission("inference.write")),
):
    """Predict the most likely crime type for an incident using the fastai model."""
    from ..ml.fastai_predict import predict_crime

    result = predict_crime(
        latitude=body.latitude,
        longitude=body.longitude,
        month=body.month,
        falls_within=body.falls_within,
        location=body.location,
        context=body.context,
        last_outcome_category=body.last_outcome_category,
    )

    # Optionally store in inference results (non-blocking: skip if Supabase is unavailable)
    try:
        supabase = get_supabase()
        model = _get_or_create_model("fastai-crime-classifier", "v1", "tabular", "fastai")
        supabase.table("ml_inference_results").insert(
            {
                "model_id": model["id"],
                "result": result,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
    except Exception:
        pass  # Supabase storage is optional; prediction still returned

    return result


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


def _store_flagged_visual_events(
    *,
    flagged_events: list[dict],
    stream_id: str | None,
) -> None:
    if not flagged_events:
        return
    supabase = get_supabase()
    rows = []
    for event in flagged_events:
        details = event.get("details", {})
        rows.append(
            {
                "event_type": event.get("event_type", "suspicious_activity"),
                "subject": event.get("subject"),
                "location": stream_id,
                "event_description": (
                    f"CV flag: {details.get('type', 'unknown')} "
                    f"(severity={details.get('severity', 'n/a')}, score={details.get('score', 'n/a')})"
                )[:1990],
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
    supabase.table("surveillance_logs").insert(rows).execute()


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
    stream_id: str | None = Form(None),
    _: str = Depends(require_permission("inference.write")),
):
    supabase = get_supabase()
    image_bytes = image.file.read()
    result = analyze_image(image_bytes, stream_id=stream_id)
    model = _get_or_create_model("farsi-vision-analytics", "v1", "cv", "opencv+transformers")
    created = supabase.table("ml_inference_results").insert(
        {
            "event_id": event_id,
            "model_id": model["id"],
            "result": result,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    if stream_id:
        supabase.table("surveillance_frames").insert(
            {
                "stream_id": stream_id,
                "detections": result.get("detections", []),
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
    _store_flagged_visual_events(flagged_events=result.get("flagged_events", []), stream_id=stream_id)
    return {"result": result, "stored": created.data[0] if created.data else None}


@router.post("/cv/video")
def cv_video_inference(
    video: UploadFile = File(...),
    event_id: str | None = Form(None),
    stream_id: str | None = Form(None),
    sample_every_n_frames: int = Form(5),
    max_frames: int = Form(300),
    _: str = Depends(require_permission("inference.write")),
):
    supabase = get_supabase()
    video_bytes = video.file.read()
    result = analyze_video(
        video_bytes,
        stream_id=stream_id,
        sample_every_n_frames=max(1, sample_every_n_frames),
        max_frames=max(1, min(max_frames, 2000)),
    )
    model = _get_or_create_model("farsi-vision-analytics", "v1", "cv", "opencv+transformers")
    created = supabase.table("ml_inference_results").insert(
        {
            "event_id": event_id,
            "model_id": model["id"],
            "result": result,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    _store_flagged_visual_events(flagged_events=result.get("flagged_events", []), stream_id=stream_id)
    return {"result": result, "stored": created.data[0] if created.data else None}


@router.post("/face-search")
def face_search(
    image: UploadFile = File(...),
    similarity_threshold: float = Form(0.45),
    top_k: int = Form(5),
    stream_id: str | None = Form(None),
    _: str = Depends(require_permission("inference.write")),
):
    """Search uploaded image against the criminal face database using ArcFace + FAISS."""
    from ..ml.face_recognition import search_faces

    image_bytes = image.file.read()
    result = search_faces(
        image_bytes,
        similarity_threshold=similarity_threshold,
        top_k=top_k,
    )

    # Store inference result
    try:
        supabase = get_supabase()
        model = _get_or_create_model("arcface-criminal-search", "v1", "face-recognition", "insightface+faiss")
        supabase.table("ml_inference_results").insert(
            {
                "model_id": model["id"],
                "result": result,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()

        # Log matched suspects as surveillance events
        for face_match in result.get("matches", []):
            for suspect in face_match.get("suspects", []):
                supabase.table("surveillance_logs").insert(
                    {
                        "event_type": "facial_recognition",
                        "subject": suspect.get("name", "Unknown"),
                        "location": stream_id,
                        "event_description": (
                            f"Face match: {suspect.get('name')} "
                            f"(ID: {suspect.get('suspect_id')}, "
                            f"confidence: {suspect.get('match_pct')}, "
                            f"risk: {suspect.get('risk_level', 'N/A')})"
                        ),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                ).execute()
    except Exception:
        pass  # Non-blocking — result is still returned

    return result


@router.get("/face-search/suspects")
def list_face_suspects(
    _: str | None = Depends(require_permission("inference.read")),
):
    """Return all suspects in the face recognition database."""
    from ..ml.face_recognition import get_suspect_database
    return {"suspects": get_suspect_database()}


@router.get("/face-search/status")
def face_model_status(
    _: str | None = Depends(require_permission("inference.read")),
):
    """Return the current status of the face recognition model."""
    from ..ml.face_recognition import get_model_status
    return get_model_status()


@router.post("/face-detect")
def face_detect(
    image: UploadFile = File(...),
    _: str = Depends(require_permission("inference.write")),
):
    """Detect faces in an image without searching the suspect database."""
    from ..ml.face_recognition import detect_faces

    image_bytes = image.file.read()
    faces = detect_faces(image_bytes)
    return {"faces_detected": len(faces), "faces": faces}


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
