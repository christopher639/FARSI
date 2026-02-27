# NLP & Text Intelligence Pipeline

## Scope
- Named Entity Recognition (NER)
- Rule-based entity linking
- Multilingual sentiment analysis
- Actionable intelligence insights for police reports and OSINT text

## Entry Points
- `POST /inference/nlp` (`backend/app/routes/inference.py`)
- Automated ingestion hook for modalities `text`, `report`, `osint` (`backend/app/routes/hooks.py`)

## Pipeline
Implemented in `backend/app/ml/nlp.py`:
- Language detection (`en` / `sw`) via lexical markers.
- NER:
  - Primary: `Davlan/xlm-roberta-base-ner-hrl` (multilingual)
  - Fallback: `dslim/bert-base-NER`
- Structured entity extraction (NER + regex entities like email/phone/URL/plate/date/time).
- Entity linking:
  - Canonicalization and deterministic entity IDs
  - Kenya place gazetteer linking
  - Agency alias linking (e.g., NPS, NIS, DCI, KDF, KWS)
- Sentiment:
  - `cardiffnlp/twitter-xlm-roberta-base-sentiment`
- Intelligence insight generation:
  - Threat signal detection (violence, weapons, urgency, coordination, cyber)
  - Threat score and priority (`low`/`medium`/`high`/`critical`)
  - Recommendations for analyst/patrol response

## Output Shape
`run_nlp(text)` returns:
- `language`
- `entities` (deduplicated extracted entities)
- `linked_entities` (entity + link metadata)
- `sentiment`
- `insights`
- `pipeline` (model metadata)

## Model Registry Metadata
- Model name: `multilingual-ner-link-sentiment`
- Version: `v2`

## Quantitative Evaluation
- Script: `scripts/evaluate_nlp_pipeline.py`
- Sample benchmark: `data/nlp/sample_benchmark.jsonl` (English + Swahili, police-report + OSINT style)

Run:
```bash
python scripts/evaluate_nlp_pipeline.py
```

Quick smoke run:
```bash
python scripts/evaluate_nlp_pipeline.py --max-samples 3
```

Offline/CI smoke mode (no model downloads):
```bash
python scripts/evaluate_nlp_pipeline.py --mode fast --max-samples 3
```

Metrics reported:
- Entity Precision / Recall / F1 (micro)
- Sentiment Accuracy
- Priority Accuracy
- Per-language breakdown (`en`, `sw`) and overall
