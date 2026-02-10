# Supabase Data Engineering Pipeline

## 1. Configure Environment
Create a `.env` file in the repo root with:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_CRIME_TABLE=crime_events
```

## 2. Install Dependencies

```
python -m pip install -r requirements.txt
```

## 3. Ingest CSV to Supabase

```
python -m pipeline.ingest_crime_csv --csv data/crime/2025-11-kenya-simulated-street.csv
```

### Generate Kenya-Simulated CSV (Avon-compatible schema)

```
python -m pipeline.simulate_kenya_crime_data --month 2025-11 --rows 8000 --out data/crime/2025-11-kenya-simulated-street.csv --seed 42 --border-share 0.20 --min-per-county 5
python -m pipeline.ingest_crime_csv --csv data/crime/2025-11-kenya-simulated-street.csv
```

## 4. Train Model from Supabase

```
python -m pipeline.train_crime_model --output-dir models
```

## 5. Import/Export Utility

```
python -m pipeline.supabase_io import --csv data/crime/2025-11-kenya-simulated-street.csv --table crime_events
python -m pipeline.supabase_io export --out data/exports/crime_events.csv --table crime_events
```

## 6. ML Inference Worker (Realtime/Batch)

```
python -m pipeline.ml_inference_worker --limit 50
```

## 7. Continuous Inference Worker (Cron-like)

```
python -m pipeline.continuous_inference_worker --interval 60 --limit 50
```

Outputs:
- `models/crime_type_model.joblib`
- `models/crime_type_model_meta.json`
- `models/predictions_sample.csv`
