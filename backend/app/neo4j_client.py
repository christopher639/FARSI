from __future__ import annotations

from functools import lru_cache
from typing import Any

from .config import settings

try:
    from neo4j import GraphDatabase
except Exception:  # pragma: no cover - optional dependency at runtime
    GraphDatabase = None


def neo4j_enabled() -> bool:
    return bool(settings.neo4j_uri and settings.neo4j_user and settings.neo4j_password and GraphDatabase)


@lru_cache(maxsize=1)
def get_neo4j_driver():
    if not neo4j_enabled():
        return None
    return GraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_user, settings.neo4j_password),
        encrypted=settings.neo4j_encrypted,
    )


def close_neo4j_driver() -> None:
    driver = get_neo4j_driver()
    if driver is not None:
        driver.close()


def run_write(query: str, parameters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    driver = get_neo4j_driver()
    if driver is None:
        return []
    params = parameters or {}
    with driver.session(database=settings.neo4j_database or None) as session:
        records = session.execute_write(lambda tx: list(tx.run(query, params)))
    return [record.data() for record in records]


def run_read(query: str, parameters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    driver = get_neo4j_driver()
    if driver is None:
        return []
    params = parameters or {}
    with driver.session(database=settings.neo4j_database or None) as session:
        records = session.execute_read(lambda tx: list(tx.run(query, params)))
    return [record.data() for record in records]
