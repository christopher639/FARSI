# MongoDB Data Engineering Pipeline

## 1. Configure Environment
Create a `.env` file in the repo root with:

```
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.dqwp2.mongodb.net/
MONGODB_DB=FARSI
MONGODB_COLLECTION=crime_events
```

## 2. Install Dependencies

```
python -m pip install -r requirements.txt
```

## 3. Ingest CSV to MongoDB

```
python -m pipeline.ingest_crime_csv --csv data/crime/2025-11-avon-and-somerset-street.csv
```

## 4. Train Model from MongoDB

```
python -m pipeline.train_crime_model --output-dir models
```

Outputs:
- `models/crime_type_model.joblib`
- `models/crime_type_model_meta.json`
- `models/predictions_sample.csv`
