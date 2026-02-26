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

