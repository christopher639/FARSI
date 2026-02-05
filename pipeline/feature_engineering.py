import pandas as pd


def clean_and_engineer(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    if "crime_type" not in df.columns and "Crime type" in df.columns:
        df = df.rename(columns={"Crime type": "crime_type"})

    df = df.dropna(subset=["crime_type"]).copy()
    df = df.drop_duplicates().copy()

    # Drop columns with >95% missing values
    missing_ratio = df.isna().mean()
    high_missing_cols = missing_ratio[missing_ratio > 0.95].index.tolist()
    if high_missing_cols:
        df = df.drop(columns=high_missing_cols)

    # Handle month column if present
    if "month" in df.columns:
        df["month"] = pd.to_datetime(df["month"], format="%Y-%m", errors="coerce")
        df["year"] = df["month"].dt.year
        df["month_num"] = df["month"].dt.month
        df = df.drop(columns=["month"])
    elif "Month" in df.columns:
        df["Month"] = pd.to_datetime(df["Month"], format="%Y-%m", errors="coerce")
        df["year"] = df["Month"].dt.year
        df["month_num"] = df["Month"].dt.month
        df = df.drop(columns=["Month"])

    # Drop unique identifiers if present
    for col in ["crime_id", "Crime ID", "record_hash", "_id"]:
        if col in df.columns:
            df = df.drop(columns=[col])

    return df
