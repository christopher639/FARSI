from collections import defaultdict
from datetime import datetime
from typing import Iterable


def generate_heatmap_cells(
    points: Iterable[dict],
    window_start: datetime,
    window_end: datetime,
    grid_size: float = 0.02,
) -> list[dict]:
    buckets: dict[tuple[float, float], int] = defaultdict(int)
    for p in points:
        lat = p.get("latitude") or p.get("lat")
        lon = p.get("longitude") or p.get("lon")
        if lat is None or lon is None:
            continue
        lat_bucket = round(float(lat) / grid_size) * grid_size
        lon_bucket = round(float(lon) / grid_size) * grid_size
        buckets[(lat_bucket, lon_bucket)] += 1

    cells = []
    for (lat, lon), count in buckets.items():
        cells.append(
            {
                "window_start": window_start.isoformat(),
                "window_end": window_end.isoformat(),
                "lat": float(lat),
                "lon": float(lon),
                "score": float(count),
            }
        )
    return cells
