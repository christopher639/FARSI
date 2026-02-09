
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
    url = os.getenv("SUPABASE_URL", "") or os.getenv("VITE_SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    table = os.getenv("SUPABASE_CRIME_TABLE", "crime_events")
    if not url:
        raise ValueError(
            "SUPABASE_URL is not set. "
            "Add SUPABASE_URL to your environment or .env file."
        )
    if not key:
        raise ValueError(
            "SUPABASE_SERVICE_ROLE_KEY is not set. "
            "Pipeline writes require the service-role key to bypass RLS. "
            "Add SUPABASE_SERVICE_ROLE_KEY to your environment or .env file. "
            "Do NOT use the anon/publishable key — it will be blocked by RLS."
        )
    return SupabaseConfig(url=url, service_role_key=key, table=table)
