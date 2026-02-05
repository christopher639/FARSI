import argparse
import hashlib
import os
import pandas as pd
from pymongo import UpdateOne

from .mongo_client import get_collection


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

    for r in records:
        r["record_hash"] = make_record_hash(r)
        # GeoJSON for geospatial queries
        r["geo"] = {
            "type": "Point",
            "coordinates": [float(r["longitude"]), float(r["latitude"])],
        }

    collection = get_collection()

    # Indexes
    collection.create_index([("geo", "2dsphere")])
    collection.create_index("record_hash", unique=True)
    collection.create_index("crime_type")

    ops = [
        UpdateOne({"record_hash": r["record_hash"]}, {"$setOnInsert": r}, upsert=True)
        for r in records
    ]

    if not ops:
        return 0

    result = collection.bulk_write(ops, ordered=False)
    inserted = result.upserted_count
    return inserted


def main():
    parser = argparse.ArgumentParser(description="Ingest crime CSV into MongoDB")
    parser.add_argument(
        "--csv",
        default="data/crime/2025-11-avon-and-somerset-street.csv",
        help="Path to CSV file",
    )
    args = parser.parse_args()

    inserted = ingest_csv(args.csv)
    print(f"Inserted {inserted} new records")


if __name__ == "__main__":
    main()
