# Crime Analytics Pipeline

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
