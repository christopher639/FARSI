import json
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_selection import SelectKBest, chi2
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MinMaxScaler, OneHotEncoder
from sklearn.svm import LinearSVC

DATA_SOURCE = Path('data/crime/.ipynb_checkpoints/2025-11-avon-and-somerset-street-checkpoint.csv')
OUTPUT_PATH = Path('public/data/crime_model_summary.json')

DISPLAY_FIELDS = [
    'Falls within',
    'Location',
    'LSOA name',
    'Longitude',
    'Latitude',
    'Context',
    'year',
    'month_num',
]


def scalar(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (np.ndarray,)) and value.size == 1:
        return float(value.item())
    return value


def ensure_ohe() -> OneHotEncoder:
    try:
        return OneHotEncoder(handle_unknown='ignore', sparse_output=True)
    except TypeError:
        return OneHotEncoder(handle_unknown='ignore', sparse=True)


def main() -> None:
    if not DATA_SOURCE.exists():
        raise FileNotFoundError(f'Missing dataset: {DATA_SOURCE}')

    df = pd.read_csv(DATA_SOURCE)
    summary: Dict[str, Any] = {}
    summary['dataset'] = {
        'original_rows': int(len(df)),
        'original_columns': int(df.shape[1]),
    }

    df = df.drop_duplicates().copy()
    df = df.dropna(subset=['Crime type']).copy()

    missing_ratio = df.isna().mean()
    high_missing = missing_ratio[missing_ratio > 0.95].index.tolist()
    if high_missing:
        df = df.drop(columns=high_missing)

    if 'Month' in df.columns:
        df['Month'] = pd.to_datetime(df['Month'], format='%Y-%m', errors='coerce')
        df['year'] = df['Month'].dt.year
        df['month_num'] = df['Month'].dt.month
        df = df.drop(columns=['Month'])

    if 'Crime ID' in df.columns:
        df = df.drop(columns=['Crime ID'])

    clean_rows = len(df)
    clean_columns = df.columns.tolist()

    target = 'Crime type'
    if target not in clean_columns:
        raise ValueError('Target column missing after cleaning')

    feature_columns = [col for col in clean_columns if col != target]

    numeric_features = df[feature_columns].select_dtypes(include=['number']).columns.tolist()
    categorical_features = [c for c in feature_columns if c not in numeric_features]

    summary['dataset'].update(
        {
            'clean_rows': int(clean_rows),
            'clean_columns': int(len(clean_columns)),
            'column_names': clean_columns,
            'feature_columns': feature_columns,
            'numeric_features': numeric_features,
            'categorical_features': categorical_features,
            'feature_count': int(len(feature_columns)),
        }
    )

    missing_ratio = df.isna().mean()
    missing_summary = []
    for column, ratio in missing_ratio.sort_values(ascending=False).head(6).items():
        missing_summary.append(
            {
                'column': column,
                'missing_percent': round(float(ratio * 100), 1),
            }
        )
    summary['dataset']['missing_columns'] = missing_summary

    target_counts = df[target].value_counts()
    distribution: List[Dict[str, Any]] = []
    for label, count in target_counts.items():
        distribution.append(
            {
                'label': label,
                'count': int(count),
                'percent': round(float(count / len(df) * 100), 1),
            }
        )
    summary['dataset']['target_distribution'] = distribution

    X = df[feature_columns]
    y = df[target]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    ohe = ensure_ohe()

    numeric_transformer = Pipeline(
        steps=[
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', MinMaxScaler()),
        ]
    )
    categorical_transformer = Pipeline(
        steps=[
            ('imputer', SimpleImputer(strategy='most_frequent')),
            ('onehot', ohe),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features),
        ],
        remainder='drop',
        sparse_threshold=0.3,
    )

    preprocessor.fit(X_train)
    X_train_pre = preprocessor.transform(X_train)
    feature_count = X_train_pre.shape[1]
    k_best = min(300, feature_count)

    models = {
        'Logistic Regression': LogisticRegression(max_iter=2000, n_jobs=-1, solver='saga'),
        'Linear SVC': LinearSVC(),
        'Random Forest': RandomForestClassifier(n_estimators=300, random_state=42, n_jobs=-1),
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    comparison: List[Dict[str, Any]] = []
    for name, model in models.items():
        pipeline = Pipeline(
            steps=[
                ('preprocessor', preprocessor),
                ('select', SelectKBest(score_func=chi2, k=k_best)),
                ('model', model),
            ]
        )
        scores = cross_validate(
            pipeline,
            X_train,
            y_train,
            cv=cv,
            scoring={'f1_macro': 'f1_macro', 'accuracy': 'accuracy'},
            n_jobs=-1,
        )
        comparison.append(
            {
                'name': name,
                'f1_macro': float(np.mean(scores['test_f1_macro'])),
                'accuracy': float(np.mean(scores['test_accuracy'])),
            }
        )

    comparison = sorted(comparison, key=lambda item: item['f1_macro'], reverse=True)
    summary['models'] = comparison

    best_model_name = comparison[0]['name']
    best_model = models[best_model_name]
    best_pipeline = Pipeline(
        steps=[
            ('preprocessor', preprocessor),
            ('select', SelectKBest(score_func=chi2, k=k_best)),
            ('model', best_model),
        ]
    )
    best_pipeline.fit(X_train, y_train)
    y_pred = best_pipeline.predict(X_test)

    report = classification_report(y_test, y_pred, output_dict=True)
    cleaned_report: Dict[str, Dict[str, Any]] = {}
    for key, metrics in report.items():
        if isinstance(metrics, dict):
            cleaned_report[key] = {
                'precision': round(float(metrics['precision']), 3),
                'recall': round(float(metrics['recall']), 3),
                'f1_score': round(float(metrics['f1-score']), 3),
                'support': int(metrics['support']),
            }
        else:
            cleaned_report[key] = {'value': round(float(metrics), 3)}

    summary['best_model'] = {
        'name': best_model_name,
        'feature_count': int(feature_count),
        'k_best': int(k_best),
        'classification_report': cleaned_report,
    }

    sample = X_test.head(10)
    predictions = best_pipeline.predict(sample)
    sample_rows: List[Dict[str, Any]] = []
    for offset, (row_index, row) in enumerate(sample.iterrows()):
        features = {
            disp_key: scalar(row[disp_key]) for disp_key in DISPLAY_FIELDS if disp_key in row.index
        }
        sample_rows.append(
            {
                'dataset_index': int(row_index),
                'features': features,
                'actual_crime_type': scalar(y_test.loc[row_index]),
                'predicted_crime_type': scalar(predictions[offset]),
            }
        )

    summary['sample_predictions'] = sample_rows

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open('w', encoding='utf-8') as out_file:
        json.dump(summary, out_file, indent=2, ensure_ascii=False)


if __name__ == '__main__':
    main()
