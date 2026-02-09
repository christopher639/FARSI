import argparse
import io
from datetime import datetime, timezone

from PIL import Image
from postgrest.exceptions import APIError
from supabase import Client, create_client
from transformers import pipeline

from .config import get_supabase_config
from .errors import raise_with_migration_hint


def get_client() -> Client:
    cfg = get_supabase_config()
    return create_client(cfg.url, cfg.service_role_key)


def ensure_model(supabase: Client, name: str, version: str, model_type: str, framework: str) -> str:
    result = (
        supabase.table("ml_models")
        .upsert(
            {"name": name, "version": version, "model_type": model_type, "framework": framework},
            on_conflict="name,version",
        )
        .execute()
    )
    if result.data:
        return result.data[0]["id"]
    existing = (
        supabase.table("ml_models")
        .select("id")
        .eq("name", name)
        .eq("version", version)
        .limit(1)
        .execute()
        .data
        or []
    )
    return existing[0]["id"]


def run_worker(limit: int = 20) -> int:
    supabase = get_client()

    try:
        events = (
            supabase.table("ingestion_events")
            .select("*")
            .is_("processed_at", "null")
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
            .data
            or []
        )
    except APIError as exc:
        raise_with_migration_hint(exc, "ingestion_events")

    if not events:
        return 0

    ner = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
    sentiment = pipeline("sentiment-analysis", model="cardiffnlp/twitter-xlm-roberta-base-sentiment")
    detector = pipeline("object-detection", model="facebook/detr-resnet-50")

    nlp_model_id = ensure_model(supabase, "ner-sentiment", "v1", "nlp", "transformers")
    cv_model_id = ensure_model(supabase, "detr-object-detection", "v1", "cv", "transformers")

    processed = 0
    for event in events:
        now = datetime.now(timezone.utc).isoformat()
        modality = event.get("modality", "text")
        description = event.get("description") or ""
        title = event.get("title") or ""
        text = f"{title}\n{description}".strip()

        if modality in {"text", "report", "osint"} and text:
            entities = ner(text)
            sent = sentiment(text)
            result = {"entities": entities, "sentiment": sent}
            supabase.table("ml_inference_results").insert(
                {"event_id": event["id"], "model_id": nlp_model_id, "result": result, "created_at": now}
            ).execute()

        if modality in {"cctv", "image", "video"} and event.get("media_path"):
            media_path = event["media_path"]
            if "/" in media_path:
                bucket, path = media_path.split("/", 1)
            else:
                bucket, path = "ingestion-media", media_path
            file_bytes = supabase.storage.from_(bucket).download(path)
            image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
            detections = detector(image)
            result = {"detections": detections}
            supabase.table("ml_inference_results").insert(
                {"event_id": event["id"], "model_id": cv_model_id, "result": result, "created_at": now}
            ).execute()

        supabase.table("ingestion_events").update(
            {"processed_at": now, "last_inference_at": now}
        ).eq("id", event["id"]).execute()
        processed += 1

    return processed


def main():
    parser = argparse.ArgumentParser(description="Process ingestion events with ML inference")
    parser.add_argument("--limit", type=int, default=20, help="Max events per run")
    args = parser.parse_args()

    count = run_worker(limit=args.limit)
    print(f"Processed {count} events")


if __name__ == "__main__":
    main()
