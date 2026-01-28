from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from src.config import MODEL_DIR


@dataclass
class TrainingResult:
    model_path: Path
    report: str
    heatmap: pd.DataFrame


def load_data(csv_path: Path, chunksize: int = 50000) -> pd.DataFrame:
    chunks: list[pd.DataFrame] = []
    for chunk in pd.read_csv(csv_path, chunksize=chunksize):
        chunks.append(chunk)
    return pd.concat(chunks, ignore_index=True)


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["DATE OCC"] = pd.to_datetime(df["DATE OCC"], errors="coerce", format="%d/%m/%Y")
    time_series = df["TIME OCC"].astype(str).str.strip()
    hhmm = time_series.str.replace(":", "", regex=False)
    time_numeric = pd.to_numeric(hhmm, errors="coerce").fillna(0)
    df["HOUR"] = (time_numeric.astype(int) // 100).astype(int)
    df["DAY_OF_WEEK"] = df["DATE OCC"].dt.dayofweek.fillna(0).astype(int)
    df["MONTH"] = df["DATE OCC"].dt.month.fillna(0).astype(int)
    df["YEAR"] = df["DATE OCC"].dt.year.fillna(0).astype(int)
    return df


def build_pipeline(categorical: Iterable[str], numerical: Iterable[str]) -> Pipeline:
    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    numerical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", categorical_transformer, list(categorical)),
            ("num", numerical_transformer, list(numerical)),
        ]
    )

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        n_jobs=-1,
        random_state=42,
        class_weight="balanced_subsample",
    )

    return Pipeline(steps=[("preprocessor", preprocessor), ("model", model)])


def generate_heatmap(df: pd.DataFrame) -> pd.DataFrame:
    heatmap = (
        df.groupby("AREA NAME")
        .size()
        .reset_index(name="incident_count")
        .sort_values("incident_count", ascending=False)
    )
    quantiles = heatmap["incident_count"].quantile([0.25, 0.5, 0.75]).to_dict()

    def severity(count: int) -> str:
        if count >= quantiles[0.75]:
            return "CRITICAL"
        if count >= quantiles[0.5]:
            return "HIGH"
        if count >= quantiles[0.25]:
            return "MEDIUM"
        return "LOW"

    heatmap["severity"] = heatmap["incident_count"].apply(severity)
    return heatmap


def train_predictive_model(csv_path: Path) -> TrainingResult:
    df = load_data(csv_path)
    df = add_time_features(df)
    df = df[(df["LAT"] != 0) & (df["LON"] != 0)]

    target = "Crm Cd"
    feature_columns = [
        "AREA NAME",
        "Rpt Dist No",
        "Premis Desc",
        "Weapon Desc",
        "Vict Age",
        "Vict Sex",
        "Vict Descent",
        "HOUR",
        "DAY_OF_WEEK",
        "MONTH",
        "YEAR",
        "LAT",
        "LON",
    ]

    df = df.dropna(subset=[target])
    X = df[feature_columns]
    y = df[target].astype(int)

    categorical = [
        "AREA NAME",
        "Premis Desc",
        "Weapon Desc",
        "Vict Sex",
        "Vict Descent",
    ]
    numerical = [
        "Rpt Dist No",
        "Vict Age",
        "HOUR",
        "DAY_OF_WEEK",
        "MONTH",
        "YEAR",
        "LAT",
        "LON",
    ]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline = build_pipeline(categorical, numerical)
    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)
    report = classification_report(y_test, y_pred, zero_division=0)

    model_path = MODEL_DIR / "crime_predictor.joblib"
    joblib.dump(pipeline, model_path)

    heatmap = generate_heatmap(df)
    heatmap_path = MODEL_DIR / "threat_heatmap.csv"
    heatmap.to_csv(heatmap_path, index=False)

    return TrainingResult(model_path=model_path, report=report, heatmap=heatmap)


def predict_single(model_path: Path, record: dict) -> int:
    pipeline = joblib.load(model_path)
    df = pd.DataFrame([record])
    df = add_time_features(df)
    prediction = pipeline.predict(df)[0]
    return int(prediction)
