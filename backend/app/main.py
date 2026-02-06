from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import get_db
from .routes import agencies, audit, auth, events, ingest, rbac
from .security import hash_password


def create_app() -> FastAPI:
    settings.validate()
    app = FastAPI(title="FARSI Backend", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(agencies.router)
    app.include_router(events.router)
    app.include_router(ingest.router)
    app.include_router(audit.router)
    app.include_router(rbac.router)

    @app.on_event("startup")
    def _startup() -> None:
        db = get_db()
        Path(settings.media_storage_dir).mkdir(parents=True, exist_ok=True)
        if settings.admin_email and settings.admin_password:
            existing = db["users"].find_one({"email": settings.admin_email})
            if not existing:
                db["users"].insert_one(
                    {
                        "email": settings.admin_email,
                        "password_hash": hash_password(settings.admin_password),
                        "role": "admin",
                        "status": "active",
                        "created_at": datetime.now(timezone.utc),
                    }
                )

    @app.get("/health")
    def health() -> dict:
        db = get_db()
        db.command("ping")
        return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}

    return app


app = create_app()
