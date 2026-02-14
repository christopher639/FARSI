import os
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise SystemExit("Supabase URL or service role key not set in environment (.env)")

headers = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
}

def fetch_events(limit=5000):
    payload = {
        "select": "id,crime_type,context,location,latitude,longitude,month,created_at,reported_by",
        "order": "created_at.asc",
        "limit": limit,
    }
    url = f"{SUPABASE_URL}/rest/v1/crime_events"
    response = requests.get(url, headers=headers, params=payload)
    response.raise_for_status()
    return response.json()

def main():
    print("syncing latest crime_events from Supabase...")
    records = fetch_events()
    if not records:
        print("no records fetched")
        return

    df = pd.DataFrame(records)
    output = Path("data/crime/crime_events_live.parquet")
    output.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output, index=False)
    print(f"Saved {len(df)} rows to {output}")

if __name__ == "__main__":
    main()
