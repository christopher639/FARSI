from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Ensure repo root is on path when running this script directly.
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.ml.nlp import run_nlp

FAST_ENTITY_PATTERNS = [
    ("EMAIL", r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    ("PHONE", r"\b(?:\+254|0)?7\d{8}\b"),
    ("URL", r"\bhttps?://[^\s]+\b"),
    ("PLATE", r"\bK[A-Z]{2}\s?\d{3}[A-Z]?\b"),
    ("TIME", r"\b(?:[01]?\d|2[0-3]):[0-5]\d\b"),
    ("DATE", r"\b\d{4}-\d{2}-\d{2}\b"),
]

FAST_LOCATIONS = {
    "nairobi", "mombasa", "nakuru", "garissa", "mandera", "wajir", "isiolo", "kisumu", "eldoret",
}

NEGATIVE_WORDS = {"attack", "robbery", "grenade", "armed", "shambulio", "wizi", "silaha", "hatari", "uvamizi"}
POSITIVE_WORDS = {"calm", "cooperative", "tulivu", "peaceful"}


@dataclass
class Counts:
    tp: int = 0
    fp: int = 0
    fn: int = 0

    def precision(self) -> float:
        denom = self.tp + self.fp
        return self.tp / denom if denom else 0.0

    def recall(self) -> float:
        denom = self.tp + self.fn
        return self.tp / denom if denom else 0.0

    def f1(self) -> float:
        p = self.precision()
        r = self.recall()
        return (2 * p * r) / (p + r) if (p + r) else 0.0


def _norm_text(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _norm_label(value: str) -> str:
    return value.strip().upper()


def _entity_set(entities: list[dict[str, Any]]) -> set[tuple[str, str]]:
    rows: set[tuple[str, str]] = set()
    for entity in entities:
        text = _norm_text(str(entity.get("text") or ""))
        label = _norm_label(str(entity.get("label") or ""))
        if not text or not label:
            continue
        rows.add((label, text))
    return rows


def _safe_first_sentiment_label(payload: dict[str, Any]) -> str:
    sentiment = payload.get("sentiment") or []
    if not isinstance(sentiment, list) or not sentiment:
        return "NEUTRAL"
    label = str(sentiment[0].get("label") or "NEUTRAL").upper()
    if "NEG" in label:
        return "NEGATIVE"
    if "POS" in label:
        return "POSITIVE"
    return "NEUTRAL"


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSONL at line {line_no}: {exc}") from exc
        records.append(row)
    return records


def _pct(value: float) -> str:
    return f"{value * 100:.2f}%"


def _print_metrics(title: str, counts: Counts, sent_correct: int, sent_total: int, pri_correct: int, pri_total: int) -> None:
    sent_acc = (sent_correct / sent_total) if sent_total else 0.0
    pri_acc = (pri_correct / pri_total) if pri_total else 0.0
    print(f"\n{title}")
    print("-" * len(title))
    print(f"Entity Precision: {_pct(counts.precision())}")
    print(f"Entity Recall:    {_pct(counts.recall())}")
    print(f"Entity F1:        {_pct(counts.f1())}")
    print(f"Sentiment Acc:    {_pct(sent_acc)} ({sent_correct}/{sent_total})")
    print(f"Priority Acc:     {_pct(pri_acc)} ({pri_correct}/{pri_total})")


def _fast_infer(text: str) -> dict[str, Any]:
    import re

    lowered = text.lower()
    entities: list[dict[str, Any]] = []
    for label, pattern in FAST_ENTITY_PATTERNS:
        for match in re.finditer(pattern, text):
            entities.append({"text": match.group(0), "label": label, "score": 0.9})

    for loc in FAST_LOCATIONS:
        if re.search(rf"\b{re.escape(loc)}\b", lowered):
            entities.append({"text": loc.title(), "label": "LOCATION", "score": 0.8})

    neg = sum(1 for word in NEGATIVE_WORDS if word in lowered)
    pos = sum(1 for word in POSITIVE_WORDS if word in lowered)
    if neg > pos:
        sentiment = [{"label": "NEGATIVE", "score": 0.75}]
    elif pos > neg:
        sentiment = [{"label": "POSITIVE", "score": 0.75}]
    else:
        sentiment = [{"label": "NEUTRAL", "score": 0.6}]

    priority = "low"
    if neg >= 3:
        priority = "critical"
    elif neg >= 2:
        priority = "high"
    elif neg >= 1:
        priority = "medium"

    return {"entities": entities, "sentiment": sentiment, "insights": {"priority": priority}}


def evaluate(records: list[dict[str, Any]], mode: str, max_samples: int | None = None) -> None:
    per_lang_counts: dict[str, Counts] = {}
    sentiment_correct: dict[str, int] = {}
    sentiment_total: dict[str, int] = {}
    priority_correct: dict[str, int] = {}
    priority_total: dict[str, int] = {}
    global_counts = Counts()

    eval_records = records[:max_samples] if max_samples is not None else records

    for sample in eval_records:
        text = str(sample.get("text") or "")
        language = str(sample.get("language") or "unknown").lower()
        expected_entities = _entity_set(sample.get("entities") or [])
        expected_sentiment = _norm_label(str(sample.get("sentiment") or "NEUTRAL"))
        expected_priority = str(sample.get("expected_priority") or "").lower()

        predicted = run_nlp(text) if mode == "full" else _fast_infer(text)
        predicted_entities = _entity_set(predicted.get("entities") or [])
        predicted_sentiment = _safe_first_sentiment_label(predicted)
        predicted_priority = str(((predicted.get("insights") or {}).get("priority") or "")).lower()

        tp = len(expected_entities & predicted_entities)
        fp = len(predicted_entities - expected_entities)
        fn = len(expected_entities - predicted_entities)

        lang_counts = per_lang_counts.setdefault(language, Counts())
        lang_counts.tp += tp
        lang_counts.fp += fp
        lang_counts.fn += fn
        global_counts.tp += tp
        global_counts.fp += fp
        global_counts.fn += fn

        sentiment_total[language] = sentiment_total.get(language, 0) + 1
        sentiment_correct[language] = sentiment_correct.get(language, 0) + int(predicted_sentiment == expected_sentiment)

        if expected_priority:
            priority_total[language] = priority_total.get(language, 0) + 1
            priority_correct[language] = priority_correct.get(language, 0) + int(predicted_priority == expected_priority)

    _print_metrics(
        "Overall",
        global_counts,
        sum(sentiment_correct.values()),
        sum(sentiment_total.values()),
        sum(priority_correct.values()),
        sum(priority_total.values()),
    )

    for language in sorted(per_lang_counts.keys()):
        _print_metrics(
            f"Language: {language}",
            per_lang_counts[language],
            sentiment_correct.get(language, 0),
            sentiment_total.get(language, 0),
            priority_correct.get(language, 0),
            priority_total.get(language, 0),
        )

    print(f"\nSamples evaluated: {len(eval_records)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate FARSI NLP pipeline (entity + sentiment + priority).")
    parser.add_argument(
        "--benchmark",
        default="data/nlp/sample_benchmark.jsonl",
        help="Path to JSONL benchmark file.",
    )
    parser.add_argument(
        "--max-samples",
        type=int,
        default=None,
        help="Optional cap for quick smoke evaluation.",
    )
    parser.add_argument(
        "--mode",
        choices=["full", "fast"],
        default="full",
        help="full = real pipeline; fast = lightweight local benchmark mode.",
    )
    args = parser.parse_args()

    benchmark_path = Path(args.benchmark)
    if not benchmark_path.exists():
        raise SystemExit(f"Benchmark file not found: {benchmark_path}")

    records = _load_jsonl(benchmark_path)
    if not records:
        raise SystemExit("Benchmark file is empty.")

    evaluate(records, mode=args.mode, max_samples=args.max_samples)


if __name__ == "__main__":
    main()
