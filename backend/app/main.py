from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routes import (
    agencies,
    alerts,
    audit,
    auth,
    communications,
    crime_reports,
    events,
    export_data,
    graph,
    heatmap,
    hooks,
    inference,
    ingest,
    models_registry,
    network,
    rbac,
    reports,
    stats,
    surveillance,
)


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
    app.include_router(export_data.router)
    app.include_router(ingest.router)
    app.include_router(audit.router)
    app.include_router(rbac.router)
    app.include_router(alerts.router)
    app.include_router(reports.router)
    app.include_router(stats.router)
    app.include_router(surveillance.router)
    app.include_router(communications.router)
    app.include_router(crime_reports.router)
    app.include_router(analytics.router)
    app.include_router(network.router)
    app.include_router(models_registry.router)
    app.include_router(inference.router)
    app.include_router(heatmap.router)
    app.include_router(graph.router)
    app.include_router(hooks.router)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}

    return app


app = create_app()
