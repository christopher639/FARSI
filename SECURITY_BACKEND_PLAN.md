# FARSI Backend Security, RBAC, and Data Provenance Plan

## 1) Environment Variables and Secrets Management

Goals: no secrets in code, least-privilege access, and auditable rotation.

Local development:
- Use `.env` for local only. Keep `.env` out of version control.
- Maintain `.env.example` with non-sensitive placeholders.
- Use separate env files per environment (local, dev, staging, prod).
- For Supabase, use `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for backend services.

Production:
- Store secrets in a secrets manager (cloud KMS or Vault-like system).
- Use short-lived credentials where possible (rotating DB passwords, JWT signing keys).
- Enforce least-privilege DB users per service (ingest, analytics, reporting).
- Maintain a secrets rotation schedule (quarterly or per policy).

Implementation in code:
- All connection strings pulled from environment variables at runtime.
- No credentials in notebooks or sample scripts.
- Add startup validation to fail fast if required env vars are missing.

## 2) RBAC (Role-Based Access Control)

Planned roles:
- Admin: full system configuration.
- Ingestor: push data into pipelines only.
- Analyst: read data, run analytics, view dashboards.
- Investigator: access case-level data and enriched links.
- Auditor: read-only access to logs and access history.

Policy model:
- Central policy-as-code (e.g., OPA/Rego or equivalent).
- Permissions defined by resource and action (dataset.read, case.write, alert.ack).
- JWTs contain role claims and scopes.

Auditability:
- Every write action creates an audit event with user, time, action, and payload hash.
- Logs are append-only and retained per policy.

## 3) Multi-Modal Ingestion (CCTV, Audio, Images)

Ingestion layers:
- Streaming: RTSP/ONVIF connectors for CCTV, Kafka for event streams.
- Batch: scheduled uploads for incident media and legacy archives.

Processing pipeline:
- Video: frame sampling + CV inference (object/vehicle/person detection).
- Audio: speech-to-text for calls/intercepts (language detection, diarization).
- Images: OCR + visual feature extraction.

Fusion:
- Normalize outputs into a unified event schema (time, location, entities, confidence).
- Store embeddings and metadata in a feature store for search and linking.
- Use Supabase Realtime for live UI updates, with batch ML workers for enrichment.

## 4) Data Provenance and Lineage

Required metadata per record:
- Source system and agency
- Ingest time and original timestamp
- Transformation steps and model versions
- Confidence scores and validation status
- Chain-of-custody identifiers

Governance:
- Dataset versioning with immutable snapshots.
- Dataset cards describing scope, bias risks, and intended use.
- Reproducibility: every inference linked to model and data versions.

## 5) Swahili/Sheng and Kenyan-Specific Data

Language coverage:
- Language detection for English, Swahili, and code-switched Sheng.
- Lexicon and normalization layer for local slang and police shorthand.

Data realism:
- Synthetic data, if used, must mirror Kenyan crime patterns and geographies.
- Use local domain experts for sampling and annotation guidelines.
- Evaluate with Kenya-specific test sets and error analyses.

## 6) Immediate Next Steps (Milestone 2)

1. Add env validation and document required variables.
2. Define RBAC matrix and integrate with auth layer.
3. Design multi-modal ingestion connectors and event schema.
4. Implement provenance schema and metadata capture in ingestion.
5. Add Swahili/Sheng NLP normalization and evaluation plan.
