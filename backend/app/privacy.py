from __future__ import annotations

import hashlib
import re
from typing import Any

from .config import settings

EMAIL_RE = re.compile(r"\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b")
PHONE_RE = re.compile(r"\b(?:\+?\d[\d\-\s]{7,}\d)\b")
NATIONAL_ID_RE = re.compile(r"\b\d{6,12}\b")
PLATE_RE = re.compile(r"\b[A-Z]{2,3}\s?\d{3}[A-Z]?\b")


def _hash_value(value: str) -> str:
    salt = settings.pii_hash_salt or "farsi-default-salt"
    return hashlib.sha256(f"{salt}:{value}".encode("utf-8")).hexdigest()[:16]


def anonymize_text(text: str | None) -> str | None:
    if text is None:
        return None
    cleaned = EMAIL_RE.sub(lambda m: f"email:{_hash_value(m.group(0))}", text)
    cleaned = PHONE_RE.sub(lambda m: f"phone:{_hash_value(m.group(0))}", cleaned)
    cleaned = NATIONAL_ID_RE.sub(lambda m: f"id:{_hash_value(m.group(0))}", cleaned)
    cleaned = PLATE_RE.sub(lambda m: f"plate:{_hash_value(m.group(0))}", cleaned)
    return cleaned


def anonymize_entities(entities: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if not entities:
        return []
    sanitized: list[dict[str, Any]] = []
    for ent in entities:
        if not isinstance(ent, dict):
            continue
        entry = dict(ent)
        entity_type = str(ent.get("type") or ent.get("entity_type") or "").lower()
        raw_value = str(ent.get("value") or ent.get("text") or ent.get("name") or "")
        if entity_type in {"person", "phone", "email", "id"} and raw_value:
            entry["value"] = f"{entity_type or 'entity'}:{_hash_value(raw_value)}"
            entry["name"] = entry.get("value")
            entry["text"] = entry.get("value")
            entry["anonymized"] = True
        sanitized.append(entry)
    return sanitized


def anonymize_coordinates(latitude: float | None, longitude: float | None, precision: int = 2) -> tuple[float | None, float | None]:
    lat = round(float(latitude), precision) if latitude is not None else None
    lon = round(float(longitude), precision) if longitude is not None else None
    return lat, lon


def anonymize_event_record(event: dict[str, Any]) -> dict[str, Any]:
    if not settings.enable_data_anonymization:
        return event
    item = dict(event)
    item["description"] = anonymize_text(item.get("description"))
    item["title"] = anonymize_text(item.get("title"))
    if isinstance(item.get("entities"), list):
        item["entities"] = anonymize_entities(item.get("entities"))
    if isinstance(item.get("location"), dict):
        location = dict(item["location"])
        lat, lon = anonymize_coordinates(location.get("lat"), location.get("lon"), precision=2)
        if lat is not None:
            location["lat"] = lat
        if lon is not None:
            location["lon"] = lon
        item["location"] = location
    return item
