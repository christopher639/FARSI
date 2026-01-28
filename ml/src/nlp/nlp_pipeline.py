from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

from src.config import MODEL_DIR

EMAIL_RE = re.compile(r"[\w\.-]+@[\w\.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"\b(?:\+254|0)?7\d{8}\b")
ID_RE = re.compile(r"\b\d{6,9}\b")
PLATE_RE = re.compile(r"\b[Kk][A-Z]{2}\s?\d{3}[A-Z]\b")


@dataclass
class NlpResult:
    model_path: Path
    report: str


def extract_entities(text: str) -> dict:
    return {
        "emails": EMAIL_RE.findall(text or ""),
        "phones": PHONE_RE.findall(text or ""),
        "ids": ID_RE.findall(text or ""),
        "plates": PLATE_RE.findall(text or ""),
    }


def train_text_classifier(csv_path: Path) -> NlpResult:
    df = pd.read_csv(csv_path)
    df = df.dropna(subset=["Crm Cd Desc", "Crm Cd"])

    X = df["Crm Cd Desc"].astype(str)
    y = df["Crm Cd"].astype(int)

    class_counts = y.value_counts()
    valid_classes = class_counts[class_counts >= 2].index
    mask = y.isin(valid_classes)
    X = X[mask]
    y = y[mask]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline = Pipeline(
        steps=[
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=3)),
            ("clf", LogisticRegression(max_iter=300)),
        ]
    )

    pipeline.fit(X_train, y_train)
    score = pipeline.score(X_test, y_test)
    report = f"Text classifier accuracy: {score:.3f}"

    model_path = MODEL_DIR / "nlp_text_classifier.joblib"
    joblib.dump(pipeline, model_path)

    return NlpResult(model_path=model_path, report=report)
