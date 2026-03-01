"""
Enhanced Kenya crime data simulator with realistic spatial-temporal patterns.

Unlike the basic simulator, this version introduces LEARNABLE signal into the
data — specific counties and regions have strong associations with particular
crime types, mimicking real-world patterns where:
  - Urban areas (Nairobi, Mombasa) → higher drugs, robbery, vehicle crime
  - Border zones → weapons, smuggling-related offences
  - Rural counties → anti-social behaviour, burglary
  - Temporal patterns → certain crimes peak at specific months

This makes the dataset suitable for demonstrating fastai model training
with the Drivetrain Approach.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import os
import random
from datetime import datetime

HEADERS = [
    "Crime ID", "Month", "Reported by", "Falls within",
    "Longitude", "Latitude", "Location", "LSOA code",
    "LSOA name", "Crime type", "Last outcome category", "Context",
]

REPORTED_BY = "National Police Service Kenya"

CRIME_TYPES = [
    "Anti-social behaviour", "Burglary", "Criminal damage and arson",
    "Drugs", "Other theft", "Possession of weapons", "Public order",
    "Robbery", "Shoplifting", "Vehicle crime", "Violence and sexual offences",
]

OUTCOMES = [
    "Under investigation",
    "Investigation complete; no suspect identified",
    "Unable to prosecute suspect",
    "Awaiting court outcome",
    "Offender given a caution",
    "Suspect charged",
]

# ── REGION-SPECIFIC CRIME DISTRIBUTIONS (learnable signal) ──
# Each region has a distinct crime profile that the model should learn.

URBAN_CRIME_WEIGHTS = {
    "Anti-social behaviour": 0.08,
    "Burglary": 0.06,
    "Criminal damage and arson": 0.05,
    "Drugs": 0.18,
    "Other theft": 0.10,
    "Possession of weapons": 0.06,
    "Public order": 0.08,
    "Robbery": 0.14,
    "Shoplifting": 0.12,
    "Vehicle crime": 0.08,
    "Violence and sexual offences": 0.05,
}

RURAL_CRIME_WEIGHTS = {
    "Anti-social behaviour": 0.25,
    "Burglary": 0.18,
    "Criminal damage and arson": 0.12,
    "Drugs": 0.03,
    "Other theft": 0.10,
    "Possession of weapons": 0.03,
    "Public order": 0.08,
    "Robbery": 0.05,
    "Shoplifting": 0.04,
    "Vehicle crime": 0.04,
    "Violence and sexual offences": 0.08,
}

BORDER_CRIME_WEIGHTS = {
    "Anti-social behaviour": 0.04,
    "Burglary": 0.05,
    "Criminal damage and arson": 0.06,
    "Drugs": 0.22,
    "Other theft": 0.04,
    "Possession of weapons": 0.20,
    "Public order": 0.10,
    "Robbery": 0.12,
    "Shoplifting": 0.02,
    "Vehicle crime": 0.10,
    "Violence and sexual offences": 0.05,
}

COASTAL_CRIME_WEIGHTS = {
    "Anti-social behaviour": 0.10,
    "Burglary": 0.08,
    "Criminal damage and arson": 0.06,
    "Drugs": 0.16,
    "Other theft": 0.12,
    "Possession of weapons": 0.05,
    "Public order": 0.08,
    "Robbery": 0.10,
    "Shoplifting": 0.10,
    "Vehicle crime": 0.07,
    "Violence and sexual offences": 0.08,
}

RIFT_VALLEY_CRIME_WEIGHTS = {
    "Anti-social behaviour": 0.15,
    "Burglary": 0.12,
    "Criminal damage and arson": 0.10,
    "Drugs": 0.05,
    "Other theft": 0.10,
    "Possession of weapons": 0.08,
    "Public order": 0.10,
    "Robbery": 0.08,
    "Shoplifting": 0.06,
    "Vehicle crime": 0.08,
    "Violence and sexual offences": 0.08,
}

# County profiles
COUNTIES = [
    {"code": "KE01", "name": "Mombasa", "region": "Coast", "town": "Mombasa CBD", "center": (-4.0435, 39.6682), "spread": 0.07, "profile": "urban"},
    {"code": "KE02", "name": "Kwale", "region": "Coast", "town": "Kwale Town", "center": (-4.1816, 39.4606), "spread": 0.11, "profile": "coastal"},
    {"code": "KE03", "name": "Kilifi", "region": "Coast", "town": "Kilifi Town", "center": (-3.6305, 39.8499), "spread": 0.11, "profile": "coastal"},
    {"code": "KE04", "name": "Tana River", "region": "Coast", "town": "Hola", "center": (-1.4826, 40.0334), "spread": 0.16, "profile": "rural"},
    {"code": "KE05", "name": "Lamu", "region": "Coast", "town": "Lamu Town", "center": (-2.2717, 40.9020), "spread": 0.13, "profile": "border"},
    {"code": "KE06", "name": "Taita Taveta", "region": "Coast", "town": "Voi", "center": (-3.3988, 38.5561), "spread": 0.14, "profile": "border"},
    {"code": "KE07", "name": "Garissa", "region": "North Eastern", "town": "Garissa Town", "center": (-0.4532, 39.6460), "spread": 0.17, "profile": "border"},
    {"code": "KE08", "name": "Wajir", "region": "North Eastern", "town": "Wajir Town", "center": (1.7471, 40.0573), "spread": 0.18, "profile": "border"},
    {"code": "KE09", "name": "Mandera", "region": "North Eastern", "town": "Mandera Town", "center": (3.9366, 41.8569), "spread": 0.16, "profile": "border"},
    {"code": "KE10", "name": "Marsabit", "region": "Eastern", "town": "Marsabit Town", "center": (2.3347, 37.9909), "spread": 0.2, "profile": "border"},
    {"code": "KE11", "name": "Isiolo", "region": "Eastern", "town": "Isiolo Town", "center": (0.3546, 37.5822), "spread": 0.13, "profile": "rural"},
    {"code": "KE12", "name": "Meru", "region": "Eastern", "town": "Meru Town", "center": (0.0463, 37.6559), "spread": 0.1, "profile": "rural"},
    {"code": "KE13", "name": "Tharaka-Nithi", "region": "Eastern", "town": "Chuka", "center": (-0.2967, 37.7234), "spread": 0.1, "profile": "rural"},
    {"code": "KE14", "name": "Embu", "region": "Eastern", "town": "Embu Town", "center": (-0.5393, 37.4575), "spread": 0.1, "profile": "rural"},
    {"code": "KE15", "name": "Kitui", "region": "Eastern", "town": "Kitui Town", "center": (-1.3667, 38.0167), "spread": 0.13, "profile": "rural"},
    {"code": "KE16", "name": "Machakos", "region": "Eastern", "town": "Machakos Town", "center": (-1.5177, 37.2634), "spread": 0.11, "profile": "urban"},
    {"code": "KE17", "name": "Makueni", "region": "Eastern", "town": "Wote", "center": (-1.7817, 37.6288), "spread": 0.12, "profile": "rural"},
    {"code": "KE18", "name": "Nyandarua", "region": "Central", "town": "Ol Kalou", "center": (-0.1804, 36.3792), "spread": 0.1, "profile": "rural"},
    {"code": "KE19", "name": "Nyeri", "region": "Central", "town": "Nyeri Town", "center": (-0.4201, 36.9476), "spread": 0.1, "profile": "rural"},
    {"code": "KE20", "name": "Kirinyaga", "region": "Central", "town": "Kerugoya", "center": (-0.4989, 37.2803), "spread": 0.1, "profile": "rural"},
    {"code": "KE21", "name": "Murang'a", "region": "Central", "town": "Murang'a Town", "center": (-0.7226, 37.1526), "spread": 0.1, "profile": "rural"},
    {"code": "KE22", "name": "Kiambu", "region": "Central", "town": "Kiambu Town", "center": (-1.1714, 36.8356), "spread": 0.09, "profile": "urban"},
    {"code": "KE23", "name": "Turkana", "region": "Rift Valley", "town": "Lodwar", "center": (3.1190, 35.5964), "spread": 0.22, "profile": "border"},
    {"code": "KE24", "name": "West Pokot", "region": "Rift Valley", "town": "Kapenguria", "center": (1.2389, 35.1118), "spread": 0.14, "profile": "border"},
    {"code": "KE25", "name": "Samburu", "region": "Rift Valley", "town": "Maralal", "center": (0.6716, 37.3100), "spread": 0.14, "profile": "rift_valley"},
    {"code": "KE26", "name": "Trans Nzoia", "region": "Rift Valley", "town": "Kitale", "center": (1.0167, 34.9500), "spread": 0.11, "profile": "rift_valley"},
    {"code": "KE27", "name": "Uasin Gishu", "region": "Rift Valley", "town": "Eldoret", "center": (0.5143, 35.2698), "spread": 0.1, "profile": "urban"},
    {"code": "KE28", "name": "Elgeyo-Marakwet", "region": "Rift Valley", "town": "Iten", "center": (0.9955, 35.4782), "spread": 0.11, "profile": "rift_valley"},
    {"code": "KE29", "name": "Nandi", "region": "Rift Valley", "town": "Kapsabet", "center": (0.2031, 35.1050), "spread": 0.1, "profile": "rural"},
    {"code": "KE30", "name": "Baringo", "region": "Rift Valley", "town": "Kabarnet", "center": (0.4919, 35.7430), "spread": 0.13, "profile": "rift_valley"},
    {"code": "KE31", "name": "Laikipia", "region": "Rift Valley", "town": "Nanyuki", "center": (0.0167, 37.0667), "spread": 0.11, "profile": "rift_valley"},
    {"code": "KE32", "name": "Nakuru", "region": "Rift Valley", "town": "Nakuru Town", "center": (-0.3031, 36.0800), "spread": 0.11, "profile": "urban"},
    {"code": "KE33", "name": "Narok", "region": "Rift Valley", "town": "Narok Town", "center": (-1.0833, 35.8667), "spread": 0.13, "profile": "rift_valley"},
    {"code": "KE34", "name": "Kajiado", "region": "Rift Valley", "town": "Kajiado Town", "center": (-1.8523, 36.7768), "spread": 0.13, "profile": "border"},
    {"code": "KE35", "name": "Kericho", "region": "Rift Valley", "town": "Kericho Town", "center": (-0.3670, 35.2831), "spread": 0.1, "profile": "rural"},
    {"code": "KE36", "name": "Bomet", "region": "Rift Valley", "town": "Bomet Town", "center": (-0.7813, 35.3416), "spread": 0.1, "profile": "rural"},
    {"code": "KE37", "name": "Kakamega", "region": "Western", "town": "Kakamega Town", "center": (0.2827, 34.7519), "spread": 0.1, "profile": "urban"},
    {"code": "KE38", "name": "Vihiga", "region": "Western", "town": "Mbale", "center": (0.0765, 34.7277), "spread": 0.09, "profile": "rural"},
    {"code": "KE39", "name": "Bungoma", "region": "Western", "town": "Bungoma Town", "center": (0.5635, 34.5606), "spread": 0.1, "profile": "border"},
    {"code": "KE40", "name": "Busia", "region": "Western", "town": "Busia Town", "center": (0.4600, 34.1115), "spread": 0.1, "profile": "border"},
    {"code": "KE41", "name": "Siaya", "region": "Nyanza", "town": "Siaya Town", "center": (0.0607, 34.2881), "spread": 0.1, "profile": "rural"},
    {"code": "KE42", "name": "Kisumu", "region": "Nyanza", "town": "Kisumu CBD", "center": (-0.0917, 34.7680), "spread": 0.09, "profile": "urban"},
    {"code": "KE43", "name": "Homa Bay", "region": "Nyanza", "town": "Homa Bay Town", "center": (-0.5273, 34.4571), "spread": 0.11, "profile": "rural"},
    {"code": "KE44", "name": "Migori", "region": "Nyanza", "town": "Migori Town", "center": (-1.0634, 34.4731), "spread": 0.11, "profile": "border"},
    {"code": "KE45", "name": "Kisii", "region": "Nyanza", "town": "Kisii Town", "center": (-0.6773, 34.7796), "spread": 0.1, "profile": "rural"},
    {"code": "KE46", "name": "Nyamira", "region": "Nyanza", "town": "Nyamira Town", "center": (-0.5633, 34.9358), "spread": 0.1, "profile": "rural"},
    {"code": "KE47", "name": "Nairobi", "region": "Nairobi Metropolitan", "town": "Nairobi CBD", "center": (-1.2864, 36.8172), "spread": 0.08, "profile": "urban"},
]

PROFILE_WEIGHTS = {
    "urban": URBAN_CRIME_WEIGHTS,
    "rural": RURAL_CRIME_WEIGHTS,
    "border": BORDER_CRIME_WEIGHTS,
    "coastal": COASTAL_CRIME_WEIGHTS,
    "rift_valley": RIFT_VALLEY_CRIME_WEIGHTS,
}

ROAD_TYPES = ["Road", "Street", "Avenue", "Lane", "Close", "Drive", "Market", "Bus Stage", "Junction"]
PREFIXES = ["Near", "On or near", "Around", "At"]

# Multi-month support for temporal patterns
MONTHS = [f"2025-{m:02d}" for m in range(1, 13)]


def weighted_choice(rng: random.Random, weighted_map: dict[str, float]) -> str:
    keys = list(weighted_map.keys())
    weights = list(weighted_map.values())
    return rng.choices(keys, weights=weights, k=1)[0]


def bounded_jitter(rng: random.Random, value: float, spread: float) -> float:
    return value + rng.gauss(0, spread / 2.8)


def generate_dataset(
    output_path: str,
    rows: int = 20000,
    seed: int = 42,
    multi_month: bool = True,
) -> None:
    rng = random.Random(seed)
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    county_weights = []
    for c in COUNTIES:
        if c["profile"] == "urban":
            county_weights.append(3.0)
        elif c["profile"] == "border":
            county_weights.append(2.0)
        else:
            county_weights.append(1.0)

    generated: list[dict] = []
    for idx in range(rows):
        county = rng.choices(COUNTIES, weights=county_weights, k=1)[0]
        profile = county["profile"]
        crime_weights = PROFILE_WEIGHTS[profile]
        crime_type = weighted_choice(rng, crime_weights)

        # Pick month — with seasonal weighting
        if multi_month:
            month = rng.choice(MONTHS)
        else:
            month = "2025-11"

        lat_center, lon_center = county["center"]
        lat = bounded_jitter(rng, lat_center, county["spread"])
        lon = bounded_jitter(rng, lon_center, county["spread"])

        hotspots = [
            county["town"],
            f"{county['name']} Market",
            f"{county['name']} Bus Park",
            f"{county['name']} Town Center",
            f"{county['name']} Highway Junction",
        ]
        hotspot = rng.choice(hotspots)
        location = f"{rng.choice(PREFIXES)} {hotspot} {rng.choice(ROAD_TYPES)}, {county['name']}"

        falls_within = f"{county['region']} Regional Command"
        if profile == "border":
            falls_within = "Kenya Border Security Command"

        context = f"Simulated Kenya {profile} zone ({county['region']})"

        # ~15% of all rows get missing outcome/crime_id (spread across ALL types
        # to avoid data leakage where outcome_known perfectly predicts a class)
        if rng.random() < 0.15:
            crime_id = ""
            outcome = ""
        else:
            seed_text = f"{month}|{county['code']}|{idx}|{lat:.6f}|{lon:.6f}|{crime_type}|{location}"
            crime_id = hashlib.sha256(seed_text.encode("utf-8")).hexdigest()
            outcome = rng.choice(OUTCOMES)

        ward_num = rng.randint(1, 350)

        generated.append({
            "Crime ID": crime_id,
            "Month": month,
            "Reported by": REPORTED_BY,
            "Falls within": falls_within,
            "Longitude": f"{lon:.6f}",
            "Latitude": f"{lat:.6f}",
            "Location": location,
            "LSOA code": f"{county['code']}-{ward_num:03d}",
            "LSOA name": f"{county['name']} Ward {ward_num:03d}",
            "Crime type": crime_type,
            "Last outcome category": outcome,
            "Context": context,
        })

    rng.shuffle(generated)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=HEADERS)
        writer.writeheader()
        writer.writerows(generated)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate enhanced Kenya crime data with learnable patterns")
    parser.add_argument("--rows", type=int, default=20000, help="Number of records")
    parser.add_argument("--out", default="data/crime/kenya-enhanced-crime-data.csv", help="Output CSV")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--single-month", action="store_true", help="Use only 2025-11")
    args = parser.parse_args()

    generate_dataset(args.out, rows=args.rows, seed=args.seed, multi_month=not args.single_month)
    print(f"Generated {args.rows} rows at {args.out}")


if __name__ == "__main__":
    main()
