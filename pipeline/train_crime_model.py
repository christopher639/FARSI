import argparse
import json
import os
import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, MinMaxScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.feature_selection import SelectKBest, chi2
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report

from .mongo_client import get_collection
from .feature_engineering import clean_and_engineer


def load_from_mongo(limit: int | None = None) -> pd.DataFrame:
    collection = get_collection()
    cursor = collection.find(
        {},
        {
            "crime_type": 1,
            "month": 1,
            "location": 1,
            "latitude": 1,
            "longitude": 1,
            "reported_by": 1,
            "falls_within": 1,
            "lsoa_code": 1,
            "lsoa_name": 1,
            "last_outcome_category": 1,
            "context": 1,
            "crime_id": 1,
        },
    )
    if limit:
        cursor = cursor.limit(limit)
    data = list(cursor)
    return pd.DataFrame(data)


def build_pipeline(preprocessor, k: int, model):
    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("select", SelectKBest(score_func=chi2, k=k)),
            ("model", model),
        ]
    )


def train_and_save(output_dir: str, limit: int | None = None) -> dict:
    df = load_from_mongo(limit=limit)
    df = clean_and_engineer(df)

    target = "crime_type"
    if target not in df.columns:
        raise ValueError("crime_type not found in data")

    X = df.drop(columns=[target])
    y = df[target]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    numeric_features = X.select_dtypes(include=["number"]).columns.tolist()
    categorical_features = [c for c in X.columns if c not in numeric_features]

    try:
        ohe = OneHotEncoder(handle_unknown="ignore", sparse_output=True)
    except TypeError:
        ohe = OneHotEncoder(handle_unknown="ignore", sparse=True)

    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", MinMaxScaler()),
        ]
    )

    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", ohe),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ]
    )

    X_train_pre = preprocessor.fit_transform(X_train)
    n_features = X_train_pre.shape[1]
    k = min(300, n_features)

    models = {
        "LogisticRegression": LogisticRegression(max_iter=2000, n_jobs=-1, solver="saga"),
        "LinearSVC": LinearSVC(),
        "RandomForest": RandomForestClassifier(n_estimators=300, random_state=42, n_jobs=-1),
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    results = []
    for name, model in models.items():
        pipeline = build_pipeline(preprocessor, k, model)
        scores = cross_validate(
            pipeline,
            X_train,
            y_train,
            cv=cv,
            scoring={"f1_macro": "f1_macro", "accuracy": "accuracy"},
            n_jobs=-1,
        )
        results.append(
            {
                "model": name,
                "f1_macro": float(np.mean(scores["test_f1_macro"])),
                "accuracy": float(np.mean(scores["test_accuracy"])),
            }
        )

    results = sorted(results, key=lambda r: r["f1_macro"], reverse=True)
    best_name = results[0]["model"]
    best_model = models[best_name]

    best_pipeline = build_pipeline(preprocessor, k, best_model)
    best_pipeline.fit(X_train, y_train)

    y_pred = best_pipeline.predict(X_test)
    report = classification_report(y_test, y_pred, output_dict=True)

    os.makedirs(output_dir, exist_ok=True)
    model_path = os.path.join(output_dir, "crime_type_model.joblib")
    joblib.dump(best_pipeline, model_path)

    # Save metrics
    meta = {
        "best_model": best_name,
        "cv_results": results,
        "test_report": report,
        "train_size": int(X_train.shape[0]),
        "test_size": int(X_test.shape[0]),
        "feature_count": int(n_features),
        "k_best": int(k),
    }
    with open(os.path.join(output_dir, "crime_type_model_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    # Sample predictions
    sample = X_test.head(50)
    preds = best_pipeline.predict(sample)
    pred_df = pd.DataFrame({"predicted_crime_type": preds})
    pred_df.to_csv(os.path.join(output_dir, "predictions_sample.csv"), index=False)

    return meta


def main():
    parser = argparse.ArgumentParser(description="Train crime type model from MongoDB")
    parser.add_argument("--output-dir", default="models", help="Output directory")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of records")
    args = parser.parse_args()

    meta = train_and_save(args.output_dir, limit=args.limit)
    print("Training complete. Best model:", meta["best_model"])


if __name__ == "__main__":
    main()
