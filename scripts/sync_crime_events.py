import argparse
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd
import requests
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

load_dotenv()

DEFAULT_OUTPUT = Path("data/crime/crime_events_live.parquet")
DEFAULT_METADATA = Path("data/crime/crime_events_sync.json")
SELECT_FIELDS = "id,crime_type,context,location,latitude,longitude,month,created_at,reported_by"

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SyncConfig:
    supabase_url: str
    supabase_key: str
    output_path: Path
    metadata_path: Path
    limit: int

    @classmethod
    def from_args(cls, args: argparse.Namespace) -> "SyncConfig":
        supabase_url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not supabase_url or not supabase_key:
            raise SystemExit("Supabase URL or service role key not set in environment (.env)")
        return cls(
            supabase_url=supabase_url,
            supabase_key=supabase_key,
            output_path=args.output_path,
            metadata_path=args.metadata_path,
            limit=args.limit,
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync latest crime events from Supabase into Parquet.")
    parser.add_argument("--limit", type=int, default=5000, help="maximum number of records to fetch per run")
    parser.add_argument("--force", action="store_true", help="ignore metadata and fetch from the beginning")
    parser.add_argument("--output-path", type=Path, default=DEFAULT_OUTPUT, help="destination Parquet file")
    parser.add_argument("--metadata-path", type=Path, default=DEFAULT_METADATA, help="sync metadata file")
    return parser.parse_args()


def create_session(api_key: str) -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=frozenset(["GET"]),
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(
        {
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
        }
    )
    return session


def read_last_synced_timestamp(metadata_path: Path) -> Optional[str]:
    if not metadata_path.exists():
        return None
    try:
        payload = json.loads(metadata_path.read_text(encoding="utf-8"))
        return payload.get("last_created_at")
    except json.JSONDecodeError:
        logger.warning("corrupt metadata at %s, falling back to full sync", metadata_path)
        return None


def persist_sync_metadata(metadata_path: Path, last_created_at: str) -> None:
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(
        json.dumps({"last_created_at": last_created_at, "synced_at": datetime.utcnow().isoformat() + "Z"}),
        encoding="utf-8",
    )


def fetch_events(session: requests.Session, config: SyncConfig, since: Optional[str]) -> list[dict]:
    params = {
        "select": SELECT_FIELDS,
        "order": "created_at.asc",
        "limit": config.limit,
    }
    if since:
        params["created_at"] = f"gt.{since}"
    url = f"{config.supabase_url.rstrip('/')}/rest/v1/crime_events"
    response = session.get(url, params=params)
    response.raise_for_status()
    return response.json()


def write_parquet(records: list[dict], output_path: Path) -> None:
    df = pd.DataFrame(records)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(output_path, index=False)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    args = parse_args()
    config = SyncConfig.from_args(args)
    session = create_session(config.supabase_key)

    last_created_at = None if args.force else read_last_synced_timestamp(config.metadata_path)
    if args.force:
        logger.info("forcing full dataset sync")
    elif last_created_at:
        logger.info("fetching records created after %s", last_created_at)
    else:
        logger.info("no metadata found; syncing all records")

    records = fetch_events(session, config, last_created_at)
    if not records:
        logger.info("no new records to sync")
        return

    write_parquet(records, config.output_path)
    last_record_ts = records[-1].get("created_at")
    if last_record_ts:
        persist_sync_metadata(config.metadata_path, last_record_ts)
        logger.info("recorded last_created_at=%s in metadata", last_record_ts)

    logger.info("saved %d rows to %s", len(records), config.output_path)


if __name__ == "__main__":
    main()
