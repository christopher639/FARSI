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
- `GET /audit/summary`
- `GET /compliance/status`
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
- `GET /graph/intelligence`
- `POST /graph/rebuild`
- `GET /federated/clients`
- `POST /federated/clients/register`
- `GET /federated/rounds`
- `POST /federated/rounds/start`
- `POST /federated/rounds/{round_id}/submit`
- `POST /federated/rounds/{round_id}/aggregate`
- `GET /export/crime-events`
- `POST /hooks/ingestion`

## Notes
- `ALLOW_PUBLIC_READ=true` allows read-only access to `GET /events` and `GET /agencies` for local frontend usage.
- For ingestion, you can use Supabase JWT auth or `X-API-Key` if `INGEST_API_KEY` is set.
- Run `python -m pipeline.ml_inference_worker` to enrich ingestion events with real ML results.
- Run `python -m pipeline.continuous_inference_worker` for cron-like continuous processing.
- Set `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` to enable graph DB synchronization and hidden-link path queries.
- Set `ENABLE_DATA_ANONYMIZATION=true` and `ANONYMIZE_READ_RESPONSES=true` to enforce privacy-by-default redaction.
- Set `FEDERATED_ENABLED=true` to enable federated learning orchestration APIs for multi-agency model collaboration.
