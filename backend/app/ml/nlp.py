from __future__ import annotations

import hashlib
import re
from functools import lru_cache
from typing import Any

from transformers import pipeline


KENYA_PLACE_GAZETTEER = {
    "nairobi",
    "mombasa",
    "kisumu",
    "nakuru",
    "eldoret",
    "garissa",
    "mandera",
    "wajir",
    "marsabit",
    "isiolo",
    "turkana",
    "kilifi",
    "kwale",
    "lamu",
    "tana river",
    "busia",
    "bungoma",
    "kakamega",
    "uasin gishu",
}

AGENCY_ALIASES = {
    "nps": "National Police Service",
    "nis": "National Intelligence Service",
    "dci": "Directorate of Criminal Investigations",
    "kdf": "Kenya Defence Forces",
    "kws": "Kenya Wildlife Service",
}

SWAHILI_MARKERS = {
    "shambulio",
    "mshukiwa",
    "wahalifu",
    "walinzi",
    "silaha",
    "doria",
    "eneo",
    "hatari",
    "tukio",
    "ripoti",
    "taarifa",
}

THREAT_KEYWORDS = {
    "violence": {
        "en": {"attack", "assault", "killing", "murder", "robbery", "kidnap", "raid", "explosion"},
        "sw": {"shambulio", "uvamizi", "wizi", "mauaji", "utekaji"},
    },
    "weapons": {
        "en": {"gun", "rifle", "pistol", "grenade", "explosive", "weapon", "armed"},
        "sw": {"bunduki", "silaha", "bomu", "milipuko", "wenye silaha"},
    },
    "urgency": {
        "en": {"urgent", "immediate", "now", "asap", "critical"},
        "sw": {"haraka", "mara moja", "dharura", "hatari kubwa"},
    },
    "coordination": {
        "en": {"meeting", "planning", "coordinate", "route", "operation"},
        "sw": {"mpango", "mkutano", "uratibu", "njia", "operesheni"},
    },
    "cyber": {
        "en": {"malware", "phishing", "breach", "exploit", "ddos", "hacked"},
        "sw": {"uvamizi mtandao", "wizi wa data"},
    },
}

ENTITY_PATTERNS = [
    ("EMAIL", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    ("PHONE", re.compile(r"\b(?:\+254|0)?7\d{8}\b")),
    ("URL", re.compile(r"\bhttps?://[^\s]+\b")),
    ("PLATE", re.compile(r"\bK[A-Z]{2}\s?\d{3}[A-Z]?\b")),
    ("ID_NUMBER", re.compile(r"\b\d{7,8}\b")),
    ("TIME", re.compile(r"\b(?:[01]?\d|2[0-3]):[0-5]\d\b")),
    ("DATE", re.compile(r"\b\d{4}-\d{2}-\d{2}\b")),
]


def _safe_pipeline(task: str, model: str, **kwargs: Any):
    try:
        return pipeline(task, model=model, **kwargs)
    except Exception:
        return None


@lru_cache(maxsize=1)
def _ner_pipeline_multilingual():
    # Multilingual high-resource NER model covers English + Swahili text reasonably well.
    return _safe_pipeline("ner", "Davlan/xlm-roberta-base-ner-hrl", aggregation_strategy="simple")


@lru_cache(maxsize=1)
def _ner_pipeline_fallback():
    return _safe_pipeline("ner", "dslim/bert-base-NER", aggregation_strategy="simple")


@lru_cache(maxsize=1)
def _sentiment_pipeline():
    return _safe_pipeline("sentiment-analysis", "cardiffnlp/twitter-xlm-roberta-base-sentiment")


def _detect_language(text: str) -> str:
    lowered = text.lower()
    sw_hits = sum(1 for marker in SWAHILI_MARKERS if marker in lowered)
    return "sw" if sw_hits >= 2 else "en"


def _normalize_entity_label(label: str) -> str:
    value = (label or "").upper().replace("-", "_")
    mapping = {
        "PER": "PERSON",
        "PERSON": "PERSON",
        "ORG": "ORGANIZATION",
        "B_ORG": "ORGANIZATION",
        "I_ORG": "ORGANIZATION",
        "LOC": "LOCATION",
        "GPE": "LOCATION",
        "MISC": "MISC",
    }
    return mapping.get(value, value or "MISC")


def _link_entity(text: str, label: str) -> dict[str, Any]:
    canonical = " ".join(text.strip().split()).lower()
    label_norm = _normalize_entity_label(label)
    kb_name = "generic"
    kb_title = canonical.title()

    if canonical in KENYA_PLACE_GAZETTEER:
        kb_name = "kenya_places"
        label_norm = "LOCATION"
        kb_title = canonical.title()
    elif canonical in AGENCY_ALIASES:
        kb_name = "kenya_agencies"
        label_norm = "ORGANIZATION"
        kb_title = AGENCY_ALIASES[canonical]

    entity_id = hashlib.sha1(f"{label_norm}:{canonical}".encode("utf-8")).hexdigest()[:16]
    return {
        "entity_id": entity_id,
        "canonical_name": kb_title,
        "entity_type": label_norm,
        "kb_source": kb_name,
        "confidence": 0.85 if kb_name != "generic" else 0.65,
    }


def _extract_regex_entities(text: str) -> list[dict[str, Any]]:
    entities: list[dict[str, Any]] = []
    for label, pattern in ENTITY_PATTERNS:
        for match in pattern.finditer(text):
            entities.append(
                {
                    "text": match.group(0),
                    "label": label,
                    "score": 0.95,
                }
            )
    return entities


def _extract_ner_entities(text: str) -> list[dict[str, Any]]:
    ner = _ner_pipeline_multilingual() or _ner_pipeline_fallback()
    if not ner:
        return []

    extracted = ner(text)
    entities: list[dict[str, Any]] = []
    for item in extracted:
        entity_text = str(item.get("word") or "").strip()
        if not entity_text:
            continue
        entities.append(
            {
                "text": entity_text,
                "label": _normalize_entity_label(str(item.get("entity_group") or item.get("entity") or "MISC")),
                "score": float(item.get("score", 0.0)),
            }
        )
    return entities


def _dedupe_entities(entities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_key: dict[tuple[str, str], dict[str, Any]] = {}
    for entity in entities:
        key = (
            str(entity.get("label") or "").upper(),
            " ".join(str(entity.get("text") or "").strip().lower().split()),
        )
        if not key[1]:
            continue
        existing = by_key.get(key)
        if existing is None or float(entity.get("score", 0.0)) > float(existing.get("score", 0.0)):
            by_key[key] = entity
    return list(by_key.values())


def _run_sentiment(text: str) -> list[dict[str, Any]]:
    model = _sentiment_pipeline()
    if not model:
        return [{"label": "NEUTRAL", "score": 0.5}]

    preds = model(text)
    normalized: list[dict[str, Any]] = []
    for pred in preds:
        label = str(pred.get("label", "neutral")).upper()
        score = float(pred.get("score", 0.0))
        if "NEG" in label:
            label = "NEGATIVE"
        elif "POS" in label:
            label = "POSITIVE"
        else:
            label = "NEUTRAL"
        normalized.append({"label": label, "score": score})
    return normalized or [{"label": "NEUTRAL", "score": 0.5}]


def _extract_insights(text: str, language: str, sentiment: list[dict[str, Any]], entities: list[dict[str, Any]]) -> dict[str, Any]:
    lowered = text.lower()
    signal_hits: dict[str, int] = {}

    for signal, bucket in THREAT_KEYWORDS.items():
        terms = set(bucket["en"]) | set(bucket["sw"])
        hits = sum(1 for term in terms if term in lowered)
        if hits:
            signal_hits[signal] = hits

    negative_sentiment = 0.0
    first = sentiment[0] if sentiment else {"label": "NEUTRAL", "score": 0.5}
    if first["label"] == "NEGATIVE":
        negative_sentiment = float(first["score"])

    location_count = sum(1 for entity in entities if entity.get("label") == "LOCATION")
    person_count = sum(1 for entity in entities if entity.get("label") == "PERSON")

    threat_score = min(
        100.0,
        15.0 * len(signal_hits)
        + 12.0 * signal_hits.get("weapons", 0)
        + 10.0 * signal_hits.get("violence", 0)
        + 20.0 * negative_sentiment
        + 4.0 * location_count,
    )

    priority = "low"
    if threat_score >= 75:
        priority = "critical"
    elif threat_score >= 55:
        priority = "high"
    elif threat_score >= 35:
        priority = "medium"

    recommendations: list[str] = []
    if signal_hits.get("weapons", 0) or signal_hits.get("violence", 0):
        recommendations.append("Escalate to tactical response and verify nearest patrol readiness.")
    if location_count > 0:
        recommendations.append("Geo-pin extracted locations and cross-check nearby incidents in last 24 hours.")
    if signal_hits.get("coordination", 0):
        recommendations.append("Flag linked entities for network analysis and communication pattern review.")
    if priority in {"high", "critical"}:
        recommendations.append("Create or update threat alert with immediate analyst review.")
    if not recommendations:
        recommendations.append("Monitor signal evolution and enrich with additional intelligence sources.")

    return {
        "language": language,
        "threat_score": threat_score,
        "priority": priority,
        "signals": [{"type": key, "count": count} for key, count in sorted(signal_hits.items(), key=lambda item: item[1], reverse=True)],
        "entity_counts": {"people": person_count, "locations": location_count, "total": len(entities)},
        "summary": f"Detected {len(entities)} entities with {priority} threat priority.",
        "recommendations": recommendations,
    }


def run_nlp(text: str) -> dict[str, Any]:
    language = _detect_language(text)
    ner_entities = _extract_ner_entities(text)
    regex_entities = _extract_regex_entities(text)
    merged = _dedupe_entities(ner_entities + regex_entities)

    linked_entities: list[dict[str, Any]] = []
    for entity in merged:
        link = _link_entity(str(entity["text"]), str(entity["label"]))
        linked_entities.append({**entity, "link": link})

    sentiment = _run_sentiment(text)
    insights = _extract_insights(text, language, sentiment, linked_entities)

    return {
        "language": language,
        "entities": merged,
        "linked_entities": linked_entities,
        "sentiment": sentiment,
        "insights": insights,
        "pipeline": {
            "ner": "multilingual_ner_with_fallback",
            "entity_linking": "rule_based_kenya_contextual_linker",
            "sentiment": "xlm_roberta_multilingual",
        },
    }
