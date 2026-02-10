import argparse
import hashlib
import os
import pandas as pd
from postgrest.exceptions import APIError

from .config import get_supabase_config
from .errors import raise_with_migration_hint
from .supabase_client import get_supabase_client

CANONICAL_ALIASES = {
    "crime_type": ["crime type", "crime_type", "type"],
    "month": ["month", "report_month"],
    "location": ["location", "place", "incident_location"],
    "longitude": ["longitude", "lon", "lng", "long"],
    "latitude": ["latitude", "lat"],
    "reported_by": ["reported by", "reported_by", "reporting_agency"],
    "falls_within": ["falls within", "falls_within", "jurisdiction"],
    "lsoa_code": ["lsoa code", "lsoa_code", "ward_code", "area_code"],
    "lsoa_name": ["lsoa name", "lsoa_name", "ward_name", "area_name", "county_name"],
    "last_outcome_category": ["last outcome category", "last_outcome_category", "outcome", "case_outcome"],
    "crime_id": ["crime id", "crime_id", "incident_id", "id"],
    "context": ["context", "notes", "description"],
}

REQUIRED_CANONICAL = ["crime_type", "month", "location", "longitude", "latitude"]


def _normalize_header(name: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else "_" for ch in str(name)).strip("_")


def _find_source_column(columns: list[str], aliases: list[str]) -> str | None:
    normalized_to_original = {_normalize_header(c): c for c in columns}
    for alias in aliases:
        key = _normalize_header(alias)
        if key in normalized_to_original:
            return normalized_to_original[key]
    return None


def _normalize_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for canonical, aliases in CANONICAL_ALIASES.items():
        source = _find_source_column(list(out.columns), aliases)
        if source:
            out[canonical] = out[source]

    missing = [field for field in REQUIRED_CANONICAL if field not in out.columns]
    if missing:
        raise ValueError(f"CSV is missing required fields after normalization: {missing}")
    return out


def make_record_hash(row: dict) -> str:
    parts = [
        str(row.get("crime_type", "")),
        str(row.get("month", "")),
        str(row.get("location", "")),
        str(row.get("latitude", "")),
        str(row.get("longitude", "")),
        str(row.get("reported_by", "")),
    ]
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def ingest_csv(csv_path: str) -> int:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    df = pd.read_csv(csv_path)
    df = _normalize_dataframe_columns(df)

    # Keep only rows with coordinates and crime_type
    df = df.dropna(subset=["latitude", "longitude", "crime_type"]).copy()
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    df = df.dropna(subset=["latitude", "longitude"]).copy()

    records = df.to_dict(orient="records")

    # Supabase JSON payloads cannot contain NaN/NaT values.
    for r in records:
        for k, v in list(r.items()):
            if pd.isna(v):
                r[k] = None

    for r in records:
        r["record_hash"] = make_record_hash(r)
        # GeoJSON for geospatial queries
        r["geo"] = {
            "type": "Point",
            "coordinates": [float(r["longitude"]), float(r["latitude"])],
        }

    if not records:
        return 0

    supabase = get_supabase_client()
    cfg = get_supabase_config()
    inserted = 0

    chunk_size = 500
    for i in range(0, len(records), chunk_size):
        chunk = records[i : i + chunk_size]
        try:
            result = supabase.table(cfg.table).upsert(chunk, on_conflict="record_hash").execute()
        except APIError as exc:
            raise_with_migration_hint(exc, cfg.table)
        inserted += len(result.data or [])
    return inserted


def main():
    parser = argparse.ArgumentParser(description="Ingest crime CSV into Supabase")
    parser.add_argument(
        "--csv",
        default="data/crime/2025-11-kenya-simulated-street.csv",
        help="Path to CSV file",
    )
    args = parser.parse_args()

    inserted = ingest_csv(args.csv)
    print(f"Inserted {inserted} new records")


if __name__ == "__main__":
    main()
