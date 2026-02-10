import argparse
import hashlib
import os
import pandas as pd
from postgrest.exceptions import APIError

from .config import get_supabase_config
from .errors import raise_with_migration_hint
from .supabase_client import get_supabase_client


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
    df = df.rename(
        columns={
            "Crime type": "crime_type",
            "Month": "month",
            "Location": "location",
            "Longitude": "longitude",
            "Latitude": "latitude",
            "Reported by": "reported_by",
            "Falls within": "falls_within",
            "LSOA code": "lsoa_code",
            "LSOA name": "lsoa_name",
            "Last outcome category": "last_outcome_category",
            "Crime ID": "crime_id",
            "Context": "context",
        }
    )

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
