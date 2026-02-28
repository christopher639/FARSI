from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .neo4j_client import close_neo4j_driver
from .routes import (
    agencies,
    analytics,
    alerts,
    audit,
    auth,
    compliance,
    communications,
    crime_reports,
    events,
    export_data,
    federated,
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
    app.include_router(federated.router)
    app.include_router(ingest.router)
    app.include_router(audit.router)
    app.include_router(compliance.router)
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

    @app.on_event("shutdown")
    def _shutdown() -> None:
        close_neo4j_driver()

    return app


app = create_app()
