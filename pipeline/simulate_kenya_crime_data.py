import argparse
import csv
import hashlib
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

REPORTED_BY = "National Police Service Kenya"

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

# 47 counties with approximate centers and county headquarters.
COUNTIES = [
    {"code": "KE01", "name": "Mombasa", "region": "Coast", "town": "Mombasa CBD", "center": (-4.0435, 39.6682), "spread": 0.07, "border": True},
    {"code": "KE02", "name": "Kwale", "region": "Coast", "town": "Kwale Town", "center": (-4.1816, 39.4606), "spread": 0.11, "border": True},
    {"code": "KE03", "name": "Kilifi", "region": "Coast", "town": "Kilifi Town", "center": (-3.6305, 39.8499), "spread": 0.11, "border": True},
    {"code": "KE04", "name": "Tana River", "region": "Coast", "town": "Hola", "center": (-1.4826, 40.0334), "spread": 0.16, "border": False},
    {"code": "KE05", "name": "Lamu", "region": "Coast", "town": "Lamu Town", "center": (-2.2717, 40.9020), "spread": 0.13, "border": True},
    {"code": "KE06", "name": "Taita Taveta", "region": "Coast", "town": "Voi", "center": (-3.3988, 38.5561), "spread": 0.14, "border": True},
    {"code": "KE07", "name": "Garissa", "region": "North Eastern", "town": "Garissa Town", "center": (-0.4532, 39.6460), "spread": 0.17, "border": True},
    {"code": "KE08", "name": "Wajir", "region": "North Eastern", "town": "Wajir Town", "center": (1.7471, 40.0573), "spread": 0.18, "border": True},
    {"code": "KE09", "name": "Mandera", "region": "North Eastern", "town": "Mandera Town", "center": (3.9366, 41.8569), "spread": 0.16, "border": True},
    {"code": "KE10", "name": "Marsabit", "region": "Eastern", "town": "Marsabit Town", "center": (2.3347, 37.9909), "spread": 0.2, "border": True},
    {"code": "KE11", "name": "Isiolo", "region": "Eastern", "town": "Isiolo Town", "center": (0.3546, 37.5822), "spread": 0.13, "border": False},
    {"code": "KE12", "name": "Meru", "region": "Eastern", "town": "Meru Town", "center": (0.0463, 37.6559), "spread": 0.1, "border": False},
    {"code": "KE13", "name": "Tharaka-Nithi", "region": "Eastern", "town": "Chuka", "center": (-0.2967, 37.7234), "spread": 0.1, "border": False},
    {"code": "KE14", "name": "Embu", "region": "Eastern", "town": "Embu Town", "center": (-0.5393, 37.4575), "spread": 0.1, "border": False},
    {"code": "KE15", "name": "Kitui", "region": "Eastern", "town": "Kitui Town", "center": (-1.3667, 38.0167), "spread": 0.13, "border": False},
    {"code": "KE16", "name": "Machakos", "region": "Eastern", "town": "Machakos Town", "center": (-1.5177, 37.2634), "spread": 0.11, "border": False},
    {"code": "KE17", "name": "Makueni", "region": "Eastern", "town": "Wote", "center": (-1.7817, 37.6288), "spread": 0.12, "border": True},
    {"code": "KE18", "name": "Nyandarua", "region": "Central", "town": "Ol Kalou", "center": (-0.1804, 36.3792), "spread": 0.1, "border": False},
    {"code": "KE19", "name": "Nyeri", "region": "Central", "town": "Nyeri Town", "center": (-0.4201, 36.9476), "spread": 0.1, "border": False},
    {"code": "KE20", "name": "Kirinyaga", "region": "Central", "town": "Kerugoya", "center": (-0.4989, 37.2803), "spread": 0.1, "border": False},
    {"code": "KE21", "name": "Murang'a", "region": "Central", "town": "Murang'a Town", "center": (-0.7226, 37.1526), "spread": 0.1, "border": False},
    {"code": "KE22", "name": "Kiambu", "region": "Central", "town": "Kiambu Town", "center": (-1.1714, 36.8356), "spread": 0.09, "border": False},
    {"code": "KE23", "name": "Turkana", "region": "Rift Valley", "town": "Lodwar", "center": (3.1190, 35.5964), "spread": 0.22, "border": True},
    {"code": "KE24", "name": "West Pokot", "region": "Rift Valley", "town": "Kapenguria", "center": (1.2389, 35.1118), "spread": 0.14, "border": True},
    {"code": "KE25", "name": "Samburu", "region": "Rift Valley", "town": "Maralal", "center": (0.6716, 37.3100), "spread": 0.14, "border": False},
    {"code": "KE26", "name": "Trans Nzoia", "region": "Rift Valley", "town": "Kitale", "center": (1.0167, 34.9500), "spread": 0.11, "border": True},
    {"code": "KE27", "name": "Uasin Gishu", "region": "Rift Valley", "town": "Eldoret", "center": (0.5143, 35.2698), "spread": 0.1, "border": False},
    {"code": "KE28", "name": "Elgeyo-Marakwet", "region": "Rift Valley", "town": "Iten", "center": (0.9955, 35.4782), "spread": 0.11, "border": False},
    {"code": "KE29", "name": "Nandi", "region": "Rift Valley", "town": "Kapsabet", "center": (0.2031, 35.1050), "spread": 0.1, "border": False},
    {"code": "KE30", "name": "Baringo", "region": "Rift Valley", "town": "Kabarnet", "center": (0.4919, 35.7430), "spread": 0.13, "border": False},
    {"code": "KE31", "name": "Laikipia", "region": "Rift Valley", "town": "Nanyuki", "center": (0.0167, 37.0667), "spread": 0.11, "border": False},
    {"code": "KE32", "name": "Nakuru", "region": "Rift Valley", "town": "Nakuru Town", "center": (-0.3031, 36.0800), "spread": 0.11, "border": False},
    {"code": "KE33", "name": "Narok", "region": "Rift Valley", "town": "Narok Town", "center": (-1.0833, 35.8667), "spread": 0.13, "border": True},
    {"code": "KE34", "name": "Kajiado", "region": "Rift Valley", "town": "Kajiado Town", "center": (-1.8523, 36.7768), "spread": 0.13, "border": True},
    {"code": "KE35", "name": "Kericho", "region": "Rift Valley", "town": "Kericho Town", "center": (-0.3670, 35.2831), "spread": 0.1, "border": False},
    {"code": "KE36", "name": "Bomet", "region": "Rift Valley", "town": "Bomet Town", "center": (-0.7813, 35.3416), "spread": 0.1, "border": False},
    {"code": "KE37", "name": "Kakamega", "region": "Western", "town": "Kakamega Town", "center": (0.2827, 34.7519), "spread": 0.1, "border": False},
    {"code": "KE38", "name": "Vihiga", "region": "Western", "town": "Mbale", "center": (0.0765, 34.7277), "spread": 0.09, "border": False},
    {"code": "KE39", "name": "Bungoma", "region": "Western", "town": "Bungoma Town", "center": (0.5635, 34.5606), "spread": 0.1, "border": True},
    {"code": "KE40", "name": "Busia", "region": "Western", "town": "Busia Town", "center": (0.4600, 34.1115), "spread": 0.1, "border": True},
    {"code": "KE41", "name": "Siaya", "region": "Nyanza", "town": "Siaya Town", "center": (0.0607, 34.2881), "spread": 0.1, "border": False},
    {"code": "KE42", "name": "Kisumu", "region": "Nyanza", "town": "Kisumu CBD", "center": (-0.0917, 34.7680), "spread": 0.09, "border": False},
    {"code": "KE43", "name": "Homa Bay", "region": "Nyanza", "town": "Homa Bay Town", "center": (-0.5273, 34.4571), "spread": 0.11, "border": False},
    {"code": "KE44", "name": "Migori", "region": "Nyanza", "town": "Migori Town", "center": (-1.0634, 34.4731), "spread": 0.11, "border": True},
    {"code": "KE45", "name": "Kisii", "region": "Nyanza", "town": "Kisii Town", "center": (-0.6773, 34.7796), "spread": 0.1, "border": False},
    {"code": "KE46", "name": "Nyamira", "region": "Nyanza", "town": "Nyamira Town", "center": (-0.5633, 34.9358), "spread": 0.1, "border": False},
    {"code": "KE47", "name": "Nairobi", "region": "Nairobi Metropolitan", "town": "Nairobi CBD", "center": (-1.2864, 36.8172), "spread": 0.08, "border": False},
]

BORDER_ZONES = [
    {"county_code": "KE09", "name": "Mandera Triangle Border", "neighbor": "Somalia/Ethiopia", "center": (3.9500, 41.8600), "hotspot": "Mandera Border Post"},
    {"county_code": "KE07", "name": "Liboi Crossing", "neighbor": "Somalia", "center": (-0.3880, 40.2790), "hotspot": "Liboi Border Gate"},
    {"county_code": "KE10", "name": "Moyale Border", "neighbor": "Ethiopia", "center": (3.5331, 39.0503), "hotspot": "Moyale One-Stop Border"},
    {"county_code": "KE23", "name": "Nadapal Corridor", "neighbor": "South Sudan", "center": (4.0650, 34.1840), "hotspot": "Nadapal Checkpoint"},
    {"county_code": "KE23", "name": "Lokichoggio Crossing", "neighbor": "South Sudan", "center": (4.2030, 34.3490), "hotspot": "Lokichoggio Transit"},
    {"county_code": "KE24", "name": "Suam Border", "neighbor": "Uganda", "center": (1.1580, 34.7150), "hotspot": "Suam Border Post"},
    {"county_code": "KE39", "name": "Malaba Border", "neighbor": "Uganda", "center": (0.6350, 34.2750), "hotspot": "Malaba OSBP"},
    {"county_code": "KE40", "name": "Busia Border", "neighbor": "Uganda", "center": (0.4600, 34.0800), "hotspot": "Busia OSBP"},
    {"county_code": "KE44", "name": "Isebania Border", "neighbor": "Tanzania", "center": (-1.1740, 34.4850), "hotspot": "Isebania Border Post"},
    {"county_code": "KE34", "name": "Namanga Border", "neighbor": "Tanzania", "center": (-2.5520, 36.7900), "hotspot": "Namanga Border Post"},
    {"county_code": "KE06", "name": "Taveta-Holili Border", "neighbor": "Tanzania", "center": (-3.4010, 37.6830), "hotspot": "Taveta Border Gate"},
    {"county_code": "KE02", "name": "Lunga Lunga Border", "neighbor": "Tanzania", "center": (-4.5530, 39.1150), "hotspot": "Lunga Lunga Border"},
    {"county_code": "KE05", "name": "Kiunga Coastal Frontier", "neighbor": "Somalia Maritime", "center": (-1.7430, 41.4840), "hotspot": "Kiunga Patrol Base"},
]

URBAN_PRIORITY = {"KE47", "KE01", "KE22", "KE32", "KE42", "KE27", "KE37", "KE03", "KE34", "KE16"}

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

BORDER_CRIME_WEIGHTS = {
    "Anti-social behaviour": 0.05,
    "Burglary": 0.06,
    "Criminal damage and arson": 0.08,
    "Drugs": 0.18,
    "Other theft": 0.06,
    "Possession of weapons": 0.16,
    "Public order": 0.11,
    "Robbery": 0.12,
    "Shoplifting": 0.03,
    "Vehicle crime": 0.10,
    "Violence and sexual offences": 0.05,
}

ROAD_TYPES = ["Road", "Street", "Avenue", "Lane", "Close", "Drive", "Market", "Bus Stage", "Junction"]
PREFIXES = ["Near", "On or near", "Around", "At"]


def weighted_choice(rng: random.Random, weighted_map: dict[str, float]) -> str:
    keys = list(weighted_map.keys())
    weights = list(weighted_map.values())
    return rng.choices(keys, weights=weights, k=1)[0]


def bounded_jitter(rng: random.Random, value: float, spread: float) -> float:
    jitter = rng.gauss(0, spread / 2.8)
    if rng.random() < 0.09:
        jitter += rng.gauss(0, spread / 1.9)
    return value + jitter


def build_county_hotspots(county: dict) -> list[str]:
    county_name = county["name"]
    town = county["town"]
    return [
        town,
        f"{county_name} Market",
        f"{county_name} Bus Park",
        f"{county_name} Town Center",
        f"{county_name} Highway Junction",
    ]


def build_location(rng: random.Random, county_name: str, hotspot: str) -> str:
    return f"{rng.choice(PREFIXES)} {hotspot} {rng.choice(ROAD_TYPES)}, {county_name}"


def make_row(
    rng: random.Random,
    month: str,
    county: dict,
    idx: int,
    lat: float,
    lon: float,
    crime_type: str,
    location: str,
    falls_within: str,
    context: str,
) -> dict:
    if crime_type == "Anti-social behaviour" and rng.random() < 0.62:
        crime_id = ""
        outcome = ""
    else:
        seed_text = f"{month}|{county['code']}|{idx}|{lat:.6f}|{lon:.6f}|{crime_type}|{location}"
        crime_id = hashlib.sha256(seed_text.encode("utf-8")).hexdigest()
        outcome = rng.choice(OUTCOMES)

    ward_num = rng.randint(1, 350)
    lsoa_code = f"{county['code']}-{ward_num:03d}"
    lsoa_name = f"{county['name']} Ward {ward_num:03d}"

    return {
        "Crime ID": crime_id,
        "Month": month,
        "Reported by": REPORTED_BY,
        "Falls within": falls_within,
        "Longitude": f"{lon:.6f}",
        "Latitude": f"{lat:.6f}",
        "Location": location,
        "LSOA code": lsoa_code,
        "LSOA name": lsoa_name,
        "Crime type": crime_type,
        "Last outcome category": outcome,
        "Context": context,
    }


def build_county_weights() -> list[float]:
    weights = []
    for county in COUNTIES:
        if county["code"] in URBAN_PRIORITY:
            weights.append(2.8)
        elif county["border"]:
            weights.append(1.7)
        else:
            weights.append(1.2)
    return weights


def generate_county_event(rng: random.Random, month: str, county: dict, idx: int) -> dict:
    lat_center, lon_center = county["center"]
    lat = bounded_jitter(rng, lat_center, county["spread"])
    lon = bounded_jitter(rng, lon_center, county["spread"])

    crime_type = weighted_choice(rng, WEIGHTS_BY_CRIME)
    hotspot = rng.choice(build_county_hotspots(county))
    location = build_location(rng, county["name"], hotspot)

    falls_within = f"{county['region']} Regional Command"
    context = "Simulated Kenya county dataset (all 47 counties represented)"

    return make_row(rng, month, county, idx, lat, lon, crime_type, location, falls_within, context)


def generate_border_event(
    rng: random.Random,
    month: str,
    county_by_code: dict[str, dict],
    idx: int,
) -> dict:
    zone = rng.choice(BORDER_ZONES)
    county = county_by_code[zone["county_code"]]
    lat_center, lon_center = zone["center"]

    lat = bounded_jitter(rng, lat_center, 0.065)
    lon = bounded_jitter(rng, lon_center, 0.065)

    crime_type = weighted_choice(rng, BORDER_CRIME_WEIGHTS)
    location = f"{rng.choice(PREFIXES)} {zone['hotspot']}, {county['name']}"
    falls_within = "Kenya Border Security Command"
    context = f"Simulated border incident corridor ({zone['neighbor']})"

    return make_row(rng, month, county, idx, lat, lon, crime_type, location, falls_within, context)


def generate_dataset(output_path: str, month: str, rows: int, seed: int, border_share: float, min_per_county: int) -> None:
    if rows <= 0:
        raise ValueError("rows must be > 0")
    if not (0.0 <= border_share <= 0.6):
        raise ValueError("border_share must be between 0.0 and 0.6")
    if min_per_county < 1:
        raise ValueError("min_per_county must be >= 1")

    datetime.strptime(month, "%Y-%m")

    county_count = len(COUNTIES)
    guaranteed_rows = county_count * min_per_county
    if rows < guaranteed_rows:
        raise ValueError(f"rows must be >= {guaranteed_rows} to guarantee {min_per_county} records for each county")

    rng = random.Random(seed)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    county_weights = build_county_weights()
    county_by_code = {c["code"]: c for c in COUNTIES}

    generated_rows: list[dict] = []
    idx = 0

    # Step 1: guaranteed county coverage across all 47 counties.
    for county in COUNTIES:
        for _ in range(min_per_county):
            generated_rows.append(generate_county_event(rng, month, county, idx))
            idx += 1

    # Step 2: fill remaining rows with a blend of county and border incidents.
    remaining = rows - len(generated_rows)
    border_rows_target = int(remaining * border_share)

    for _ in range(border_rows_target):
        generated_rows.append(generate_border_event(rng, month, county_by_code, idx))
        idx += 1

    for _ in range(remaining - border_rows_target):
        county = rng.choices(COUNTIES, weights=county_weights, k=1)[0]
        generated_rows.append(generate_county_event(rng, month, county, idx))
        idx += 1

    rng.shuffle(generated_rows)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=HEADERS)
        writer.writeheader()
        writer.writerows(generated_rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Kenya-simulated crime CSV matching Avon schema")
    parser.add_argument("--month", default="2025-11", help="Month in YYYY-MM format")
    parser.add_argument("--rows", type=int, default=8000, help="Number of records to generate")
    parser.add_argument(
        "--out",
        default="data/crime/2025-11-kenya-simulated-street.csv",
        help="Output CSV path",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument(
        "--border-share",
        type=float,
        default=0.20,
        help="Share of non-guaranteed records sampled from border zones (0.0 to 0.6)",
    )
    parser.add_argument(
        "--min-per-county",
        type=int,
        default=5,
        help="Minimum guaranteed records for each county",
    )
    args = parser.parse_args()

    generate_dataset(
        output_path=args.out,
        month=args.month,
        rows=args.rows,
        seed=args.seed,
        border_share=args.border_share,
        min_per_county=args.min_per_county,
    )
    print(f"Generated {args.rows} rows at {args.out}")


if __name__ == "__main__":
    main()
