"""
fastai crime-type prediction integration for the FARSI backend.

Provides a thin wrapper that loads the exported fastai model once and
exposes a ``predict`` function consumed by the inference route.
"""

from __future__ import annotations

import math
import os
import re
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

# ── Constants duplicated from pipeline.fastai_crime_model for zero-import overhead ──

REGION_MAP = {
    "Coast Regional Command": "Coast",
    "North Eastern Regional Command": "North Eastern",
    "Eastern Regional Command": "Eastern",
    "Central Regional Command": "Central",
    "Rift Valley Regional Command": "Rift Valley",
    "Western Regional Command": "Western",
    "Nyanza Regional Command": "Nyanza",
    "Nairobi Metropolitan Regional Command": "Nairobi",
    "Kenya Border Security Command": "Border",
}


def _extract_county(location: str | None) -> str:
    if not location:
        return "Unknown"
    parts = location.split(",")
    return parts[-1].strip() if len(parts) > 1 else "Unknown"


def _extract_road_type(location: str | None) -> str:
    if not location:
        return "Unknown"
    road_types = [
        "Road", "Street", "Avenue", "Lane", "Close",
        "Drive", "Market", "Bus Stage", "Junction", "Bus Park",
    ]
    for rt in road_types:
        if rt.lower() in location.lower():
            return rt
    return "Other"


def _is_border(context: str | None) -> int:
    return 1 if context and "border" in context.lower() else 0


def _extract_border_neighbor(context: str | None) -> str:
    if not context:
        return "None"
    match = re.search(r"\(([^)]+)\)", str(context))
    return match.group(1) if match else "None"


def _engineer_single(row: dict) -> pd.DataFrame:
    """Engineer features for a single prediction row."""
    df = pd.DataFrame([row])

    rename_map = {
        "Crime type": "crime_type", "Month": "month",
        "Falls within": "falls_within", "Location": "location",
        "Context": "context", "Last outcome category": "last_outcome_category",
        "Latitude": "latitude", "Longitude": "longitude",
    }
    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})

    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")

    if "month" in df.columns:
        dt = pd.to_datetime(df["month"], format="%Y-%m", errors="coerce")
        df["year"] = dt.dt.year.fillna(2025).astype(int)
        df["month_num"] = dt.dt.month.fillna(1).astype(int)
        df["month_sin"] = np.sin(2 * math.pi * df["month_num"] / 12)
        df["month_cos"] = np.cos(2 * math.pi * df["month_num"] / 12)

    nairobi_lat, nairobi_lon = -1.2864, 36.8172
    df["dist_nairobi_km"] = np.sqrt(
        ((df["latitude"] - nairobi_lat) * 111) ** 2
        + ((df["longitude"] - nairobi_lon) * 111 * np.cos(np.radians(df["latitude"]))) ** 2
    )

    df["lat_grid"] = (df["latitude"] * 2).round() / 2
    df["lon_grid"] = (df["longitude"] * 2).round() / 2
    df["geo_cell"] = df["lat_grid"].astype(str) + "_" + df["lon_grid"].astype(str)

    df["region"] = df.get("falls_within", pd.Series(["Unknown"])).map(REGION_MAP).fillna("Unknown")
    df["county"] = df["location"].apply(_extract_county) if "location" in df.columns else "Unknown"
    df["road_type"] = df["location"].apply(_extract_road_type) if "location" in df.columns else "Unknown"
    df["is_border"] = df["context"].apply(_is_border) if "context" in df.columns else 0
    df["border_neighbor"] = df["context"].apply(_extract_border_neighbor) if "context" in df.columns else "None"
    df["outcome_known"] = df["last_outcome_category"].notna().astype(int) if "last_outcome_category" in df.columns else 0

    drop_cols = [
        "crime_id", "month", "reported_by", "location",
        "lsoa_code", "lsoa_name", "context", "falls_within",
        "last_outcome_category", "lat_grid", "lon_grid", "crime_type",
    ]
    df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors="ignore")

    return df


MODEL_PATH = os.environ.get(
    "FASTAI_CRIME_MODEL_PATH",
    str(Path(__file__).resolve().parent.parent.parent.parent / "models" / "fastai_crime_model.pkl"),
)


@lru_cache(maxsize=1)
def _load_learner():
    from fastai.tabular.all import load_learner
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"fastai model not found at {MODEL_PATH}. "
            "Run `python -m pipeline.fastai_crime_model` to train first."
        )
    return load_learner(MODEL_PATH)


def predict_crime(
    latitude: float,
    longitude: float,
    month: str = "2025-11",
    falls_within: str = "Nairobi Metropolitan Regional Command",
    location: str = "Unknown",
    context: str = "",
    last_outcome_category: str | None = "Under investigation",
) -> dict:
    """
    Predict crime type for a single incident using the trained fastai model.
    Returns predicted class, confidence, and per-class probabilities.

    Uses direct tensor inference to avoid fastai predict() issues with
    single-row DataFrames and unknown target values.
    """
    import torch

    learn = _load_learner()
    vocab = list(learn.dls.vocab)

    row = {
        "latitude": latitude,
        "longitude": longitude,
        "month": month,
        "falls_within": falls_within,
        "location": location,
        "context": context,
        "last_outcome_category": last_outcome_category,
    }

    df = _engineer_single(row)

    # Use the learner's internal TabularPandas processor to transform
    # the row into the same encoding used during training, then run
    # the model directly — avoids predict()'s loss-computation requirement.
    to = learn.dls.train_ds.new(df)
    to.process()

    cat_tensor = torch.tensor(to.cats.values, dtype=torch.long)
    cont_tensor = torch.tensor(to.conts.values, dtype=torch.float32)

    learn.model.eval()
    with torch.no_grad():
        logits = learn.model(cat_tensor, cont_tensor)
        probs = torch.softmax(logits, dim=1).squeeze()

    pred_idx = int(probs.argmax().item())
    pred_class = vocab[pred_idx] if pred_idx < len(vocab) else "Unknown"

    class_probs = {
        name: round(float(p), 4)
        for name, p in zip(vocab, probs.tolist())
    }

    return {
        "predicted_crime_type": pred_class,
        "confidence": round(float(probs.max().item()), 4),
        "probabilities": class_probs,
    }
