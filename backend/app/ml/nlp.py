from functools import lru_cache
from typing import Any

from transformers import pipeline


@lru_cache(maxsize=1)
def _ner_pipeline():
    return pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")


@lru_cache(maxsize=1)
def _sentiment_pipeline():
    return pipeline("sentiment-analysis", model="cardiffnlp/twitter-xlm-roberta-base-sentiment")


def run_nlp(text: str) -> dict[str, Any]:
    ner = _ner_pipeline()(text)
    sentiment = _sentiment_pipeline()(text)
    entities = []
    for item in ner:
        entities.append(
            {
                "text": item.get("word"),
                "label": item.get("entity_group") or item.get("entity"),
                "score": float(item.get("score", 0)),
            }
        )
    return {"entities": entities, "sentiment": sentiment}
