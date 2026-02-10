import argparse
import csv
import hashlib
import math
import os
import random
from datetime import datetime

HEADERS = [
    "Crime ID",
    "Month",
    "Reported by",
    "Falls within",
    "Longitude",
    "Latitude",
    "Location",
    "LSOA code",
    "LSOA name",
    "Crime type",
    "Last outcome category",
    "Context",
]

CRIME_TYPES = [
    "Anti-social behaviour",
    "Burglary",
    "Criminal damage and arson",
    "Drugs",
    "Other theft",
    "Possession of weapons",
    "Public order",
    "Robbery",
    "Shoplifting",
    "Vehicle crime",
    "Violence and sexual offences",
]

OUTCOMES = [
    "Under investigation",
    "Investigation complete; no suspect identified",
    "Unable to prosecute suspect",
    "Awaiting court outcome",
    "Offender given a caution",
    "Suspect charged",
]

# Approx county/city centers and hotspot names
AREAS = [
    {
        "county_code": "KE30",
        "county_name": "Nairobi",
        "reported_by": "National Police Service Kenya",
        "falls_within": "Nairobi Metropolitan Command",
        "center": (-1.286389, 36.817223),
        "spread": 0.08,
        "hotspots": ["CBD", "Eastleigh", "Kibera", "Westlands", "Embakasi", "Kasarani"],
    },
    {
        "county_code": "KE01",
        "county_name": "Mombasa",
        "reported_by": "National Police Service Kenya",
        "falls_within": "Coast Regional Command",
        "center": (-4.043477, 39.668206),
        "spread": 0.06,
        "hotspots": ["Nyali", "Likoni", "Kisauni", "Bamburi", "Mvita"],
    },
    {
        "county_code": "KE32",
        "county_name": "Kiambu",
        "reported_by": "National Police Service Kenya",
        "falls_within": "Central Regional Command",
        "center": (-1.17139, 36.83556),
        "spread": 0.07,
        "hotspots": ["Thika", "Ruiru", "Kiambu Town", "Juja", "Limuru"],
    },
    {
        "county_code": "KE47",
        "county_name": "Nakuru",
        "reported_by": "National Police Service Kenya",
        "falls_within": "Rift Valley Regional Command",
        "center": (-0.303099, 36.080025),
        "spread": 0.09,
        "hotspots": ["Nakuru Town", "Naivasha", "Molo", "Njoro", "Gilgil"],
    },
    {
        "county_code": "KE20",
        "county_name": "Kisumu",
        "reported_by": "National Police Service Kenya",
        "falls_within": "Nyanza Regional Command",
        "center": (-0.091702, 34.767956),
        "spread": 0.07,
        "hotspots": ["Kisumu CBD", "Manyatta", "Kondele", "Milimani", "Nyalenda"],
    },
    {
        "county_code": "KE16",
        "county_name": "Machakos",
        "reported_by": "National Police Service Kenya",
        "falls_within": "Eastern Regional Command",
        "center": (-1.517683, 37.263414),
        "spread": 0.08,
        "hotspots": ["Machakos Town", "Mlolongo", "Athi River", "Kangundo", "Matuu"],
    },
]

WEIGHTS_BY_CRIME = {
    "Anti-social behaviour": 0.18,
    "Burglary": 0.10,
    "Criminal damage and arson": 0.09,
    "Drugs": 0.09,
    "Other theft": 0.11,
    "Possession of weapons": 0.05,
    "Public order": 0.11,
    "Robbery": 0.06,
    "Shoplifting": 0.08,
    "Vehicle crime": 0.07,
    "Violence and sexual offences": 0.16,
}


def weighted_choice(rng: random.Random, weighted_map: dict[str, float]) -> str:
    keys = list(weighted_map.keys())
    weights = list(weighted_map.values())
    return rng.choices(keys, weights=weights, k=1)[0]


def bounded_jitter(rng: random.Random, value: float, spread: float) -> float:
    # Gaussian-like jitter with occasional broader variance to create hotspots/tails
    jitter = rng.gauss(0, spread / 2.5)
    if rng.random() < 0.08:
        jitter += rng.gauss(0, spread / 1.8)
    return value + jitter


def build_location(rng: random.Random, county_name: str, hotspot: str) -> str:
    road_types = ["Road", "Street", "Avenue", "Lane", "Close", "Drive", "Market", "Bus Stage", "Junction"]
    prefixes = ["Near", "On or near", "Around", "At"]
    return f"{rng.choice(prefixes)} {hotspot} {rng.choice(road_types)}, {county_name}"


def generate_row(rng: random.Random, month: str, area: dict, idx: int) -> dict:
    lat_center, lon_center = area["center"]
    lat = bounded_jitter(rng, lat_center, area["spread"])
    lon = bounded_jitter(rng, lon_center, area["spread"])

    crime_type = weighted_choice(rng, WEIGHTS_BY_CRIME)

    # Mirror Avon behavior: some ASB rows have blank IDs/outcomes
    if crime_type == "Anti-social behaviour" and rng.random() < 0.65:
        crime_id = ""
        outcome = ""
    else:
        seed_text = f"{month}|{area['county_code']}|{idx}|{lat:.6f}|{lon:.6f}|{crime_type}"
        crime_id = hashlib.sha256(seed_text.encode("utf-8")).hexdigest()
        outcome = rng.choice(OUTCOMES)

    hotspot = rng.choice(area["hotspots"])
    ward_num = rng.randint(1, 250)
    lsoa_code = f"{area['county_code']}-{ward_num:03d}"
    lsoa_name = f"{area['county_name']} Ward {ward_num:03d}"

    return {
        "Crime ID": crime_id,
        "Month": month,
        "Reported by": area["reported_by"],
        "Falls within": area["falls_within"],
        "Longitude": f"{lon:.6f}",
        "Latitude": f"{lat:.6f}",
        "Location": build_location(rng, area["county_name"], hotspot),
        "LSOA code": lsoa_code,
        "LSOA name": lsoa_name,
        "Crime type": crime_type,
        "Last outcome category": outcome,
        "Context": "Simulated dataset for Kenya scenario planning",
    }


def generate_dataset(output_path: str, month: str, rows: int, seed: int) -> None:
    if rows <= 0:
        raise ValueError("rows must be > 0")

    # Basic month validation (YYYY-MM)
    datetime.strptime(month, "%Y-%m")

    rng = random.Random(seed)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=HEADERS)
        writer.writeheader()

        area_weights = [0.36, 0.16, 0.14, 0.14, 0.11, 0.09]
        for idx in range(rows):
            area = rng.choices(AREAS, weights=area_weights, k=1)[0]
            writer.writerow(generate_row(rng, month, area, idx))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Kenya-simulated crime CSV matching Avon schema")
    parser.add_argument("--month", default="2025-11", help="Month in YYYY-MM format")
    parser.add_argument("--rows", type=int, default=6000, help="Number of records to generate")
    parser.add_argument(
        "--out",
        default="data/crime/2025-11-kenya-simulated-street.csv",
        help="Output CSV path",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    generate_dataset(output_path=args.out, month=args.month, rows=args.rows, seed=args.seed)
    print(f"Generated {args.rows} rows at {args.out}")


if __name__ == "__main__":
    main()
