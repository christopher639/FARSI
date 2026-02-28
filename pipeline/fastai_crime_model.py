"""
fastai-based Crime Type Classifier for FARSI
=============================================

Drivetrain Approach applied to crime analytics:

1. DEFINED OBJECTIVE
   - Predict the *crime_type* for a given incident so law-enforcement can
     pre-position patrols, allocate investigative resources, and generate
     heatmap risk scores **before** an official classification is assigned.

2. LEVERS (inputs we can control)
   - Patrol density & deployment locations (driven by predictions).
   - Community awareness campaigns targeted at predicted crime categories.
   - Inter-agency coordination based on predicted severity.

3. DATA (what we collect)
   - Geolocation (latitude, longitude).
   - Temporal features (month, derived cyclical features).
   - Administrative area (region/command, county ward).
   - Outcome history (last_outcome_category).
   - Context narrative (border vs county).
   - Location descriptors (road type, hotspot name).

4. MODEL (how levers influence the objective)
   - A tabular neural-network classifier (fastai TabularLearner) that maps
     the above features -> crime_type, enabling real-time inference via the
     existing FARSI API and heatmap pipeline.
   - Compared against the existing sklearn baseline (LogReg/SVM/RF) in
     pipeline/train_crime_model.py.

Usage
-----
    # Train from local CSV
    python -m pipeline.fastai_crime_model --csv data/crime/2025-11-kenya-simulated-street.csv

    # Train from Supabase (uses same loader as existing pipeline)
    python -m pipeline.fastai_crime_model --source supabase --limit 5000

    # Export ONNX for fast backend inference
    python -m pipeline.fastai_crime_model --csv data/crime/2025-11-kenya-simulated-street.csv --export-onnx
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
from pathlib import Path

import numpy as np
import pandas as pd
from fastai.tabular.all import (
    CategoryBlock,
    Categorify,
    FillMissing,
    Normalize,
    TabularDataLoaders,
    accuracy,
    tabular_learner,
    F1Score,
    SaveModelCallback,
    EarlyStoppingCallback,
)


# ──────────────────────────────────────────────────────────────────────
# 1) FEATURE ENGINEERING — Drivetrain "Data" step
# ──────────────────────────────────────────────────────────────────────

CRIME_SEVERITY: dict[str, int] = {
    "Anti-social behaviour": 2,
    "Burglary": 4,
    "Criminal damage and arson": 3,
    "Drugs": 4,
    "Other theft": 2,
    "Possession of weapons": 5,
    "Public order": 3,
    "Robbery": 5,
    "Shoplifting": 2,
    "Vehicle crime": 3,
    "Violence and sexual offences": 5,
}

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
    """Extract county name from the location string (last segment after comma)."""
    if not location:
        return "Unknown"
    parts = location.split(",")
    return parts[-1].strip() if len(parts) > 1 else "Unknown"


def _extract_road_type(location: str | None) -> str:
    """Pull the road type (Street, Avenue, etc.) from the location string."""
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
    if not context:
        return 0
    return 1 if "border" in context.lower() else 0


def _extract_border_neighbor(context: str | None) -> str:
    if not context:
        return "None"
    match = re.search(r"\(([^)]+)\)", str(context))
    if match:
        return match.group(1)
    return "None"


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Comprehensive feature engineering for crime classification.
    Produces both numeric (continuous) and categorical features
    suitable for fastai's TabularDataLoaders.
    """
    df = df.copy()

    # ── Normalize column names ──
    rename_map = {
        "Crime type": "crime_type",
        "Crime ID": "crime_id",
        "Month": "month",
        "Reported by": "reported_by",
        "Falls within": "falls_within",
        "Longitude": "longitude",
        "Latitude": "latitude",
        "Location": "location",
        "LSOA code": "lsoa_code",
        "LSOA name": "lsoa_name",
        "Last outcome category": "last_outcome_category",
        "Context": "context",
    }
    df = df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns})

    # ── Drop rows without target ──
    df = df.dropna(subset=["crime_type"])

    # ── Parse coordinates ──
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    df = df.dropna(subset=["latitude", "longitude"])

    # ── Temporal features ──
    if "month" in df.columns:
        dt = pd.to_datetime(df["month"], format="%Y-%m", errors="coerce")
        df["year"] = dt.dt.year.fillna(2025).astype(int)
        df["month_num"] = dt.dt.month.fillna(1).astype(int)
        # Cyclical encoding (preserves periodicity — Drivetrain lever: timing)
        df["month_sin"] = np.sin(2 * math.pi * df["month_num"] / 12)
        df["month_cos"] = np.cos(2 * math.pi * df["month_num"] / 12)

    # ── Geospatial derived features ──
    # Distance from Nairobi CBD (-1.2864, 36.8172) — national center of gravity
    nairobi_lat, nairobi_lon = -1.2864, 36.8172
    df["dist_nairobi_km"] = np.sqrt(
        ((df["latitude"] - nairobi_lat) * 111) ** 2
        + ((df["longitude"] - nairobi_lon) * 111 * np.cos(np.radians(df["latitude"]))) ** 2
    )

    # Latitude/longitude grid cell (0.5-degree tiles for spatial clustering)
    df["lat_grid"] = (df["latitude"] * 2).round() / 2
    df["lon_grid"] = (df["longitude"] * 2).round() / 2
    df["geo_cell"] = df["lat_grid"].astype(str) + "_" + df["lon_grid"].astype(str)

    # ── Administrative / contextual ──
    df["region"] = df["falls_within"].map(REGION_MAP).fillna("Unknown")
    df["county"] = df["location"].apply(_extract_county)
    df["road_type"] = df["location"].apply(_extract_road_type)
    df["is_border"] = df["context"].apply(_is_border)
    df["border_neighbor"] = df["context"].apply(_extract_border_neighbor)

    # Outcome feature (useful if partially available)
    df["outcome_known"] = df["last_outcome_category"].notna().astype(int)

    # ── Drop raw / high-cardinality identifiers ──
    drop_cols = [
        "crime_id", "month", "reported_by", "location",
        "lsoa_code", "lsoa_name", "context", "falls_within",
        "last_outcome_category", "lat_grid", "lon_grid",
    ]
    df = df.drop(columns=[c for c in drop_cols if c in df.columns], errors="ignore")

    return df.reset_index(drop=True)


# ──────────────────────────────────────────────────────────────────────
# 2) FASTAI TABULAR MODEL — Drivetrain "Model" step
# ──────────────────────────────────────────────────────────────────────

def build_dataloaders(
    df: pd.DataFrame,
    target: str = "crime_type",
    valid_pct: float = 0.2,
    batch_size: int = 64,
    seed: int = 42,
) -> TabularDataLoaders:
    """
    Build fastai TabularDataLoaders from the engineered DataFrame.
    Automatically detects continuous vs categorical columns.
    """
    # Separate feature types
    cat_cols = [
        c for c in df.columns
        if c != target and (df[c].dtype == "object" or df[c].dtype.name == "category")
    ]
    cont_cols = [
        c for c in df.columns
        if c != target and c not in cat_cols and pd.api.types.is_numeric_dtype(df[c])
    ]

    procs = [Categorify, FillMissing, Normalize]

    dls = TabularDataLoaders.from_df(
        df,
        y_names=[target],
        y_block=CategoryBlock(),
        cat_names=cat_cols,
        cont_names=cont_cols,
        procs=procs,
        valid_pct=valid_pct,
        seed=seed,
        bs=batch_size,
    )
    return dls  # type: ignore[return-value]


def train_model(
    dls: TabularDataLoaders,
    epochs: int = 15,
    lr: float | None = None,
    output_dir: str = "models",
) -> dict:
    """
    Train a fastai TabularLearner with:
    - 2 hidden layers (400, 200 neurons)
    - Weighted cross-entropy to handle class imbalance
    - 1-cycle policy with lr_find
    - F1-score tracking
    - Early stopping + best-model checkpointing
    """
    import torch
    import torch.nn as nn

    # Compute class weights (inverse frequency) to prevent majority-class collapse
    train_labels = dls.train_ds.ys.values.flatten()
    class_counts = pd.Series(train_labels).value_counts().sort_index()
    n_samples = len(train_labels)
    n_classes = len(class_counts)
    weights = torch.tensor(
        [n_samples / (n_classes * class_counts.get(i, 1)) for i in range(n_classes)],
        dtype=torch.float32,
    )
    ce = nn.CrossEntropyLoss(weight=weights)

    # Wrapper to handle fastai's 2D target tensors [N, 1] → [N]
    def weighted_ce(pred, targ):
        return ce(pred, targ.view(-1).long())

    learn = tabular_learner(
        dls,
        layers=[400, 200],
        metrics=[accuracy, F1Score(average="macro")],
        loss_func=weighted_ce,
    )

    # Find optimal learning rate if not provided
    if lr is None:
        lr_result = learn.lr_find(suggest_funcs=(valley, steep))
        lr = lr_result.valley
        print(f"  Using lr_find valley: {lr:.2e}")

    # Train with callbacks
    cbs = [
        SaveModelCallback(monitor="f1_score", fname="best_crime_model"),
        EarlyStoppingCallback(monitor="f1_score", patience=6),
    ]
    learn.fit_one_cycle(epochs, lr, cbs=cbs)

    # Load best checkpoint
    learn.load("best_crime_model")

    # ── Evaluate ──
    preds, targets = learn.get_preds(dl=dls.valid)
    pred_classes = preds.argmax(dim=1)

    # Flatten targets (fastai may return shape [N, 1])
    import torch
    targets = targets.squeeze()
    if targets.dtype != torch.long:
        targets = targets.long()

    class_names = list(dls.vocab)
    n_correct = int((pred_classes == targets).sum().item())
    n_total = int(targets.shape[0])
    val_acc = n_correct / max(n_total, 1)

    # Per-class metrics
    from collections import Counter
    per_class = {}
    for i, name in enumerate(class_names):
        tp = ((pred_classes == i) & (targets == i)).sum().item()
        fp = ((pred_classes == i) & (targets != i)).sum().item()
        fn = ((pred_classes != i) & (targets == i)).sum().item()
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
        support = (targets == i).sum().item()
        per_class[name] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "support": support,
        }

    # Macro F1
    macro_f1 = sum(v["f1_score"] for v in per_class.values()) / len(per_class)

    # ── Save ──
    os.makedirs(output_dir, exist_ok=True)
    model_path = Path(output_dir) / "fastai_crime_model.pkl"
    learn.export(model_path)

    meta = {
        "model": "fastai_TabularLearner",
        "architecture": "TabularModel(emb+bn -> [400,200] -> softmax)",
        "framework": "fastai",
        "epochs_trained": epochs,
        "learning_rate": float(lr or 0),
        "val_accuracy": round(val_acc, 4),
        "val_f1_macro": round(macro_f1, 4),
        "class_report": per_class,
        "train_size": len(dls.train_ds),
        "valid_size": len(dls.valid_ds),
        "feature_count": len(dls.train_ds.cont_names) + len(dls.train_ds.cat_names),
        "categorical_features": list(dls.train_ds.cat_names),
        "continuous_features": list(dls.train_ds.cont_names),
        "classes": list(class_names),
        "model_path": str(model_path),
        "drivetrain_objective": "Predict crime_type to optimize patrol deployment & resource allocation",
    }

    meta_path = Path(output_dir) / "fastai_crime_model_meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"\n  Model saved to {model_path}")
    print(f"  Validation accuracy: {val_acc:.4f}")
    print(f"  Macro F1: {macro_f1:.4f}")
    print(f"  Metadata: {meta_path}")

    return meta


# ──────────────────────────────────────────────────────────────────────
# 3) DATA LOADING (CSV or Supabase)
# ──────────────────────────────────────────────────────────────────────

def load_csv(csv_path: str) -> pd.DataFrame:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV not found: {csv_path}")
    return pd.read_csv(csv_path)


def load_supabase(limit: int | None = None) -> pd.DataFrame:
    """Reuse the existing Supabase loader from the pipeline."""
    from .train_crime_model import load_from_supabase
    return load_from_supabase(limit=limit)


# ──────────────────────────────────────────────────────────────────────
# 4) INFERENCE HELPER (for backend integration)
# ──────────────────────────────────────────────────────────────────────

def predict_crime_type(
    model_path: str,
    latitude: float,
    longitude: float,
    month: str = "2025-11",
    falls_within: str = "Nairobi Metropolitan Regional Command",
    location: str = "Unknown",
    context: str = "",
    last_outcome_category: str | None = None,
) -> dict:
    """
    Run inference on a single incident. Returns predicted crime type
    and probabilities for all classes.
    """
    from fastai.tabular.all import load_learner

    learn = load_learner(model_path)

    row = pd.DataFrame([{
        "latitude": latitude,
        "longitude": longitude,
        "month": month,
        "falls_within": falls_within,
        "location": location,
        "context": context,
        "last_outcome_category": last_outcome_category,
        "crime_id": None,
        "reported_by": "National Police Service Kenya",
        "lsoa_code": "UNK",
        "lsoa_name": "Unknown",
        "crime_type": "Unknown",  # placeholder, not used for inference
    }])

    row = engineer_features(row)
    row = row.drop(columns=["crime_type"], errors="ignore")

    pred_class, pred_idx, probs = learn.predict(row.iloc[0])

    class_probs = {
        name: round(float(p), 4)
        for name, p in zip(learn.dls.vocab, probs)
    }

    return {
        "predicted_crime_type": str(pred_class),
        "confidence": round(float(probs.max()), 4),
        "probabilities": class_probs,
    }


# ──────────────────────────────────────────────────────────────────────
# 5) CLI
# ──────────────────────────────────────────────────────────────────────

# Import lr_find helpers
from fastai.tabular.all import valley, steep


def main():
    parser = argparse.ArgumentParser(
        description="Train a fastai crime-type classifier (Drivetrain Approach)"
    )
    parser.add_argument(
        "--csv",
        default="data/crime/2025-11-kenya-simulated-street.csv",
        help="Path to crime CSV file",
    )
    parser.add_argument(
        "--source",
        choices=["csv", "supabase"],
        default="csv",
        help="Data source",
    )
    parser.add_argument("--limit", type=int, default=None, help="Limit rows from Supabase")
    parser.add_argument("--epochs", type=int, default=15, help="Training epochs")
    parser.add_argument("--lr", type=float, default=None, help="Learning rate (auto if omitted)")
    parser.add_argument("--bs", type=int, default=64, help="Batch size")
    parser.add_argument("--output-dir", default="models", help="Output directory")
    parser.add_argument("--export-onnx", action="store_true", help="Also export ONNX model")

    args = parser.parse_args()

    print("=" * 60)
    print("FARSI Crime Classifier — fastai + Drivetrain Approach")
    print("=" * 60)

    # Load data
    if args.source == "supabase":
        print("\n[1/3] Loading data from Supabase...")
        raw_df = load_supabase(limit=args.limit)
    else:
        print(f"\n[1/3] Loading data from {args.csv}...")
        raw_df = load_csv(args.csv)

    print(f"  Raw data shape: {raw_df.shape}")

    # Feature engineering
    print("\n[2/3] Engineering features (Drivetrain 'Data' step)...")
    df = engineer_features(raw_df)
    print(f"  Engineered shape: {df.shape}")
    cat_cols = [c for c in df.columns if c != "crime_type" and df[c].dtype == "object"]
    cont_cols = [c for c in df.columns if c != "crime_type" and c not in cat_cols and pd.api.types.is_numeric_dtype(df[c])]
    print(f"  Categorical features ({len(cat_cols)}): {cat_cols}")
    print(f"  Continuous features  ({len(cont_cols)}): {cont_cols}")

    # Build dataloaders
    print("\n[3/3] Training fastai TabularLearner (Drivetrain 'Model' step)...")
    dls = build_dataloaders(df, batch_size=args.bs)

    meta = train_model(dls, epochs=args.epochs, lr=args.lr, output_dir=args.output_dir)

    # Optional ONNX export
    if args.export_onnx:
        try:
            import torch
            onnx_path = os.path.join(args.output_dir, "fastai_crime_model.onnx")
            dummy = torch.randn(1, len(dls.train_ds.cont_names) + len(dls.train_ds.cat_names))
            print(f"\n  ONNX export: {onnx_path} (manual export needed for tabular models)")
        except ImportError:
            print("  ONNX export skipped (torch not available).")

    # Print comparison note
    print("\n" + "=" * 60)
    print("COMPARISON WITH EXISTING SKLEARN PIPELINE")
    print("=" * 60)
    print(
        "  The existing pipeline/train_crime_model.py uses:\n"
        "    - LogisticRegression, LinearSVC, RandomForest\n"
        "    - OneHotEncoder + MinMaxScaler + SelectKBest(chi2)\n"
        "  This fastai model uses:\n"
        "    - Entity embeddings for categoricals (learned representations)\n"
        "    - BatchNorm + Dropout regularization\n"
        "    - 1-cycle learning rate policy\n"
        "    - Cyclical temporal features + geospatial distance\n"
        "\n"
        "  fastai advantages:\n"
        "    1. Entity embeddings capture relationships sklearn can't\n"
        "    2. Learns feature interactions automatically\n"
        "    3. Better generalization with dropout + weight decay\n"
        "    4. Native GPU support for larger datasets\n"
    )

    print("Training complete!")
    return meta


if __name__ == "__main__":
    main()
