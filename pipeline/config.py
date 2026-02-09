
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class SupabaseConfig:
    url: str
    service_role_key: str
    table: str


def get_supabase_config() -> SupabaseConfig:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    table = os.getenv("SUPABASE_CRIME_TABLE", "crime_events")
    if not url or not key:
        raise ValueError("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env")
    return SupabaseConfig(url=url, service_role_key=key, table=table)
