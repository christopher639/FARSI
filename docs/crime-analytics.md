# Crime Analytics Pipeline

## fastai Crime Classifier (Drivetrain Approach)

The project now includes a fastai-based tabular deep learning model alongside the existing sklearn pipeline.

### Drivetrain Approach

| Step | Description |
|------|-------------|
| **Defined Objective** | Predict `crime_type` for incoming incidents to optimize patrol deployment, resource allocation, and risk scoring |
| **Levers** | Patrol density, community awareness campaigns, inter-agency coordination — all driven by predictions |
| **Data** | Geolocation, temporal features, admin regions, outcomes, context narratives |
| **Model** | fastai `TabularLearner` with entity embeddings, mapping engineered features → crime_type |

### Training

```bash
# Train from local CSV (default: enhanced dataset)
python -m pipeline.fastai_crime_model --csv data/crime/kenya-enhanced-crime-data.csv

# Train from Supabase
python -m pipeline.fastai_crime_model --source supabase --limit 5000

# Generate enhanced training data (20K records with learnable spatial patterns)
python -m pipeline.simulate_enhanced_data --rows 20000
```

### API Endpoint

```bash
# Predict crime type for a location
curl -X POST http://localhost:8000/inference/predict-crime \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude": -1.2864, "longitude": 36.8172, "month": "2025-11", "falls_within": "Nairobi Metropolitan Regional Command"}'
```

### Engineered Features

| Feature | Type | Description |
|---------|------|-------------|
| `latitude`, `longitude` | Continuous | Raw coordinates |
| `dist_nairobi_km` | Continuous | Distance from Nairobi CBD (national gravity center) |
| `month_sin`, `month_cos` | Continuous | Cyclical month encoding |
| `is_border` | Continuous | Binary flag for border-zone incidents |
| `region` | Categorical | Regional command (entity-embedded) |
| `county` | Categorical | County extracted from location string |
| `road_type` | Categorical | Street/Avenue/Market/Junction/etc. |
| `geo_cell` | Categorical | 0.5-degree lat/lon grid tile |
| `border_neighbor` | Categorical | Neighboring country for border events |

---

## Original Pipeline

1. **Source the training payload**
   - Call `GET /analytics/crime-patterns`. The response includes `month`, `hour`, `day_of_week`, `latitude`, `longitude`, `location`, `context`, and `crime_type`.
   - Use `features` array to align the payload with your model inputs and treat `crime_type` as the target label.

2. **Feature engineering ideas**
   - Derive cyclical features from `hour`/`day_of_week` (`sin`, `cos`) to preserve periodicity.
   - Tokenize `context` with your NLP library or bucket short narratives into categories.
   - Bucket `location`/`areaName` with the existing `location` label to capture spatial clusters.

3. **Training workflow outline**
   - Pull the sample (limit 2500 rows) every time you retrain, or stream it into your pipeline for incremental updates.
   - Use `latitude`/`longitude` plus `month/hour/day_of_week` as time-space features; leave `crime_type` as the sequence/class label for your classifier or seq2seq architecture.
   - Log metrics and store the best model version in your model registry (or `models_registry` table if you automate with Supabase).

4. **Automation hooks**
   - Schedule a cron job that re-fetches `/analytics/crime-patterns`, stores the blob in your training dataset, trains the model, and updates `threat_heatmap_cells` or `ml_models` via the REST API.
   - Optionally send a notification through `supabase.functions.invoke('send-login-alert')` or integrations to Ops once retraining finishes.

5. **Sample request**
   ```bash
   curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" https://your-backend/api/analytics/crime-patterns
   ```

6. **Security**

7. **Hotspot predictions**
   - Use `GET /analytics/predicted-hotspots` to retrieve the 5 most frequently reported locations (counts are proxies for risk). Link them back to your deployment schedule or geofencing logic.
   - Trigger `POST /analytics/refresh-hotspots` to recalc the top 10 heatmap cells after new batches have been ingested. Call this from your scheduler or manually when new crime data arrives.

8. **Sync live crime data**
   - Run `python scripts/sync_crime_events.py` once you configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.
   - The script stores a live extract in `data/crime/crime_events_live.parquet`, which your notebook can load via `pd.read_parquet` in place of the CSV.
   - Automate this script before retraining so your model and analytics always use the most recent events.
   - Because the endpoint uses `allow_public_read("events.read")`, only authenticated roles with that permission (or public read if enabled) can access the payload. Ensure service accounts are provisioned correctly when automating retraining.
