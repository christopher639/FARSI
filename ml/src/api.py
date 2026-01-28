from __future__ import annotations

import os
import shutil
import tempfile
from functools import lru_cache
from pathlib import Path
from time import perf_counter
from typing import Optional

import joblib
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from src.config import DATA_DIR, MODEL_DIR
from src.cv.cv_anomaly import detect_motion
from src.cv.ucf_crime import download_ucf_crime, predict_ucf_crime, train_ucf_crime_model
from src.ml.predictive_analytics import predict_single, train_predictive_model
from src.nlp.nlp_pipeline import extract_entities, train_text_classifier
from src.schemas import (
    EntityResponse,
    HeatmapPoint,
    HeatmapResponse,
    HeatmapPointsResponse,
    MotionEvent,
    MotionRequest,
    MotionResponse,
    PredictRequest,
    PredictResponse,
    SimulatedResponse,
    TextClassifyRequest,
    TextClassifyResponse,
    TrainResponse,
    UcfPredictRequest,
    UcfPredictResponse,
    UcfTrainRequest,
    UcfTrainResponse,
)

app = FastAPI(title="FARSI AI Services", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_PATH = Path(os.getenv("FARSI_DATA_PATH", DATA_DIR / "crime_in_la.csv"))
PREDICT_MODEL_PATH = MODEL_DIR / "crime_predictor.joblib"
NLP_MODEL_PATH = MODEL_DIR / "nlp_text_classifier.joblib"
HEATMAP_PATH = MODEL_DIR / "threat_heatmap.csv"
SEVERITY_WEIGHTS = {
    "LOW": 0.7,
    "MEDIUM": 1.0,
    "HIGH": 1.3,
    "CRITICAL": 1.6,
}


def infer_severity(df: pd.DataFrame) -> pd.Series:
    weapon = df["Weapon Desc"].fillna("").str.upper()
    crime = df["Crm Cd Desc"].fillna("").str.upper()
    severity = pd.Series("LOW", index=df.index)

    medium_mask = crime.str.contains(
        "THEFT|VANDALISM|FRAUD|DRUG|NARCOTIC|VEHICLE|TRESPASS",
        regex=True,
    )
    severity.loc[medium_mask] = "MEDIUM"

    high_mask = weapon.str.contains(
        "KNIFE|BLADE|CUTTING|STABBING|BLUNT|CLUB|BAT|MACHETE",
        regex=True,
    ) | crime.str.contains(
        "ROBBERY|ASSAULT|CARJACK|BURGLARY|KIDNAPPING",
        regex=True,
    )
    severity.loc[high_mask] = "HIGH"

    critical_mask = weapon.str.contains(
        "FIREARM|GUN|SHOTGUN|RIFLE|SEMIAUTOMATIC|BOMB|EXPLOSIVE",
        regex=True,
    ) | crime.str.contains(
        "HOMICIDE|MURDER|RAPE|ARSON|TERROR",
        regex=True,
    )
    severity.loc[critical_mask] = "CRITICAL"
    return severity


@lru_cache(maxsize=1)
def load_heatmap_df() -> pd.DataFrame:
    if not DATA_PATH.exists():
        raise HTTPException(status_code=404, detail="Data file not found.")
    cols = [
        "AREA NAME",
        "LAT",
        "LON",
        "DATE OCC",
        "TIME OCC",
        "Crm Cd Desc",
        "Weapon Desc",
    ]
    df = pd.read_csv(DATA_PATH, usecols=cols, low_memory=False)
    df = df.dropna(subset=["LAT", "LON"])
    df = df[(df["LAT"] != 0) & (df["LON"] != 0)]

    df["date_occ"] = pd.to_datetime(df["DATE OCC"], errors="coerce", format="%m/%d/%Y")
    time_occ = pd.to_numeric(df["TIME OCC"], errors="coerce").fillna(0).astype(int)
    df["hour"] = (time_occ // 100).clip(lower=0, upper=23)

    df["severity"] = infer_severity(df)
    df["weight"] = df["severity"].map(SEVERITY_WEIGHTS).fillna(1.0)
    return df


def apply_heatmap_filters(
    df: pd.DataFrame,
    start_date: Optional[str],
    end_date: Optional[str],
    start_hour: Optional[int],
    end_hour: Optional[int],
    severities: Optional[str],
    crime_query: Optional[str],
) -> pd.DataFrame:
    mask = pd.Series(True, index=df.index)

    if start_date:
        start_dt = pd.to_datetime(start_date, errors="coerce")
        if pd.notna(start_dt):
            mask &= df["date_occ"] >= start_dt
    if end_date:
        end_dt = pd.to_datetime(end_date, errors="coerce")
        if pd.notna(end_dt):
            mask &= df["date_occ"] <= end_dt

    if start_hour is not None and end_hour is not None:
        if start_hour <= end_hour:
            mask &= df["hour"].between(start_hour, end_hour)
        else:
            mask &= (df["hour"] >= start_hour) | (df["hour"] <= end_hour)

    if severities:
        severity_list = [s.strip().upper() for s in severities.split(",") if s.strip()]
        if severity_list:
            mask &= df["severity"].isin(severity_list)

    if crime_query:
        mask &= df["Crm Cd Desc"].fillna("").str.contains(
            crime_query,
            case=False,
            na=False,
            regex=False,
        )

    return df[mask]


def area_severity(counts: pd.Series) -> pd.Series:
    if counts.empty:
        return pd.Series(dtype=str)
    q90 = counts.quantile(0.9)
    q70 = counts.quantile(0.7)
    q40 = counts.quantile(0.4)
    severity = pd.Series("LOW", index=counts.index)
    severity.loc[counts >= q40] = "MEDIUM"
    severity.loc[counts >= q70] = "HIGH"
    severity.loc[counts >= q90] = "CRITICAL"
    return severity


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/ml/train", response_model=TrainResponse)
def train_model() -> TrainResponse:
    if not DATA_PATH.exists():
        raise HTTPException(status_code=404, detail=f"Data file not found: {DATA_PATH}")
    start = perf_counter()
    result = train_predictive_model(DATA_PATH)
    elapsed = perf_counter() - start
    return TrainResponse(
        message=f"Training completed in {elapsed:.2f}s",
        model_path=str(result.model_path),
        report=result.report,
    )


@app.post("/ml/predict", response_model=PredictResponse)
def predict(request: PredictRequest) -> PredictResponse:
    if not PREDICT_MODEL_PATH.exists():
        raise HTTPException(status_code=404, detail="Model not trained yet. Call /ml/train first.")
    prediction = predict_single(PREDICT_MODEL_PATH, request.record)
    return PredictResponse(prediction=prediction)


@app.get("/ml/heatmap", response_model=HeatmapResponse)
def heatmap(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    start_hour: Optional[int] = None,
    end_hour: Optional[int] = None,
    severities: Optional[str] = None,
    crime: Optional[str] = None,
) -> HeatmapResponse:
    use_precomputed = not any([start_date, end_date, start_hour, end_hour, severities, crime])
    if HEATMAP_PATH.exists() and use_precomputed:
        df = pd.read_csv(HEATMAP_PATH)
        if "severity" not in df.columns:
            if "incident_count" in df.columns:
                df["severity"] = area_severity(df["incident_count"])
            else:
                df["severity"] = "MEDIUM"
        rows = df.to_dict(orient="records")
        return HeatmapResponse(rows=[{str(k): v for k, v in row.items()} for row in rows])

    df = load_heatmap_df()
    df = apply_heatmap_filters(df, start_date, end_date, start_hour, end_hour, severities, crime)
    if df.empty:
        return HeatmapResponse(rows=[])
    grouped = df[["AREA NAME"]].copy()
    grouped["incident_count"] = 1
    grouped = grouped.groupby("AREA NAME").sum().reset_index()
    grouped["severity"] = area_severity(grouped["incident_count"])
    rows = grouped.to_dict(orient="records")
    return HeatmapResponse(rows=[{str(k): v for k, v in row.items()} for row in rows])


@app.get("/ml/heatmap/points", response_model=HeatmapPointsResponse)
def heatmap_points(
    limit: int = 5000,
    seed: int = 42,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    start_hour: Optional[int] = None,
    end_hour: Optional[int] = None,
    severities: Optional[str] = None,
    crime: Optional[str] = None,
) -> HeatmapPointsResponse:
    df = load_heatmap_df()
    df = apply_heatmap_filters(df, start_date, end_date, start_hour, end_hour, severities, crime)
    if df.empty:
        return HeatmapPointsResponse(points=[])

    if len(df) > limit:
        df = df.sample(n=limit, random_state=seed)

    points = df.rename(
        columns={
            "LAT": "lat",
            "LON": "lon",
            "Crm Cd Desc": "crime_desc",
            "DATE OCC": "date",
            "AREA NAME": "area_name",
        }
    )[
        ["lat", "lon", "weight", "severity", "area_name", "crime_desc", "date", "hour"]
    ].copy()
    points["crime_desc"] = points["crime_desc"].fillna("")
    points["date"] = points["date"].fillna("")
    point_dicts = points.to_dict(orient="records")
    normalized = [{str(k): v for k, v in p.items()} for p in point_dicts]
    return HeatmapPointsResponse(points=[HeatmapPoint(**p) for p in normalized])


@app.post("/nlp/train", response_model=TrainResponse)
def train_nlp() -> TrainResponse:
    if not DATA_PATH.exists():
        raise HTTPException(status_code=404, detail=f"Data file not found: {DATA_PATH}")
    start = perf_counter()
    result = train_text_classifier(DATA_PATH)
    elapsed = perf_counter() - start
    return TrainResponse(
        message=f"Training completed in {elapsed:.2f}s",
        model_path=str(result.model_path),
        report=result.report,
    )


@app.post("/nlp/classify", response_model=TextClassifyResponse)
def classify(request: TextClassifyRequest) -> TextClassifyResponse:
    if not NLP_MODEL_PATH.exists():
        raise HTTPException(status_code=404, detail="NLP model not trained yet. Call /nlp/train first.")
    pipeline = joblib.load(NLP_MODEL_PATH)
    prediction = int(pipeline.predict([request.text])[0])
    return TextClassifyResponse(prediction=prediction)


@app.post("/nlp/entities", response_model=EntityResponse)
def entities(request: TextClassifyRequest) -> EntityResponse:
    data = extract_entities(request.text)
    return EntityResponse(**data)


@app.post("/cv/motion", response_model=MotionResponse)
def motion(request: MotionRequest) -> MotionResponse:
    video_path = Path(request.video_path)
    if not video_path.exists():
        raise HTTPException(status_code=404, detail=f"Video not found: {video_path}")
    events = detect_motion(video_path, min_area=request.min_area)
    return MotionResponse(events=[MotionEvent(**event.__dict__) for event in events])


@app.post("/cv/ucf/train", response_model=UcfTrainResponse)
def train_ucf(request: UcfTrainRequest) -> UcfTrainResponse:
    label_mode = (request.label_mode or "binary").strip().lower()
    if label_mode not in {"binary", "multiclass"}:
        raise HTTPException(status_code=400, detail="label_mode must be 'binary' or 'multiclass'")

    dataset_root = Path(request.dataset_path) if request.dataset_path else download_ucf_crime(request.dataset_id)

    start = perf_counter()
    result = train_ucf_crime_model(
        dataset_root,
        label_mode=label_mode,  # type: ignore[arg-type]
        epochs=request.epochs,
        batch_size=request.batch_size,
        lr=request.lr,
        num_frames=request.num_frames,
        size=request.size,
        max_videos=request.max_videos,
        seed=request.seed,
        val_split=request.val_split,
        freeze_backbone=request.freeze_backbone,
    )
    elapsed = perf_counter() - start

    return UcfTrainResponse(
        message=f"UCF training completed in {elapsed:.2f}s",
        model_path=str(result.model_path),
        labels_path=str(result.labels_path),
        label_mode=result.label_mode,
        samples_used=result.samples_used,
        train_accuracy=result.train_accuracy,
        val_accuracy=result.val_accuracy,
        report=result.report,
    )


@app.post("/cv/ucf/predict", response_model=UcfPredictResponse)
def predict_ucf(request: UcfPredictRequest) -> UcfPredictResponse:
    video_path = Path(request.video_path)
    if not video_path.exists():
        raise HTTPException(status_code=404, detail=f"Video not found: {video_path}")

    label_mode = (request.label_mode or "binary").strip().lower()
    if label_mode not in {"binary", "multiclass"}:
        raise HTTPException(status_code=400, detail="label_mode must be 'binary' or 'multiclass'")

    try:
        payload = predict_ucf_crime(
            video_path,
            label_mode=label_mode,  # type: ignore[arg-type]
            num_frames=request.num_frames,
            size=request.size,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return UcfPredictResponse(**payload)


@app.post("/cv/ucf/predict/upload", response_model=UcfPredictResponse)
async def predict_ucf_upload(
    file: UploadFile = File(...),
    label_mode: str = Form("binary"),
    num_frames: int = Form(16),
    size: int = Form(112),
) -> UcfPredictResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    normalized_mode = (label_mode or "binary").strip().lower()
    if normalized_mode not in {"binary", "multiclass"}:
        raise HTTPException(status_code=400, detail="label_mode must be 'binary' or 'multiclass'")

    suffix = Path(file.filename).suffix.lower()
    if suffix and suffix not in {".mp4", ".avi", ".mkv", ".mov", ".mpg", ".mpeg"}:
        raise HTTPException(status_code=400, detail=f"Unsupported video extension: {suffix}")

    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix or ".mp4") as tmp:
            tmp_path = Path(tmp.name)
            shutil.copyfileobj(file.file, tmp)

        payload = predict_ucf_crime(
            tmp_path,
            label_mode=normalized_mode,  # type: ignore[arg-type]
            num_frames=num_frames,
            size=size,
        )
        return UcfPredictResponse(**payload)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    finally:
        try:
            if tmp_path and tmp_path.exists():
                tmp_path.unlink()
        except OSError:
            pass


@app.get("/simulate/alerts", response_model=SimulatedResponse)
def simulate_alerts() -> SimulatedResponse:
    return SimulatedResponse(
        message="Simulated alerts",
        data=[
            {
                "id": "ALT-001",
                "severity": "CRITICAL",
                "status": "Investigating",
                "location": "Nairobi",
                "source": "Intel Exchange",
            },
            {
                "id": "ALT-002",
                "severity": "HIGH",
                "status": "New",
                "location": "Garissa",
                "source": "Border Ops",
            },
        ],
    )
