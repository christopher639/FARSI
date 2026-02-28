# FARSI Backend (FastAPI + Supabase/Postgres)

## Quick Start
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` with required values (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`), then run:
```bash
uvicorn backend.app.main:app --reload --port 8000
```

## Key Endpoints
- `GET /health`
- `POST /auth/login`
- `GET /agencies`
- `POST /ingest/text`
- `POST /ingest/media`
- `GET /events`
- `GET /audit`
- `GET /alerts`
- `GET /reports`
- `GET /surveillance/streams`
- `GET /communications`
- `GET /network`
- `GET /models`
- `POST /inference/nlp`
- `POST /inference/cv`
- `POST /inference/cv/video`
- `POST /inference/heatmap`
- `GET /heatmap`
- `GET /graph/nodes`
- `GET /export/crime-events`
- `POST /hooks/ingestion`

## Notes
- `ALLOW_PUBLIC_READ=true` allows read-only access to `GET /events` and `GET /agencies` for local frontend usage.
- For ingestion, you can use Supabase JWT auth or `X-API-Key` if `INGEST_API_KEY` is set.
- Run `python -m pipeline.ml_inference_worker` to enrich ingestion events with real ML results.
- Run `python -m pipeline.continuous_inference_worker` for cron-like continuous processing.
