# FARSI Backend (FastAPI + MongoDB)

## Quick Start
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create `.env` with required values, then run:
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

## Notes
- `ALLOW_PUBLIC_READ=true` allows read-only access to `GET /events` and `GET /agencies` for local frontend usage.
- For ingestion, you can use JWT auth or `X-API-Key` if `INGEST_API_KEY` is set.
