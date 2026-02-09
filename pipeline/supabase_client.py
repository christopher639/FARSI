from supabase import Client, create_client

from .config import get_supabase_config


_client: Client | None = None


def get_supabase_client() -> Client:
    global _client
    if _client is None:
        cfg = get_supabase_config()
        _client = create_client(cfg.url, cfg.service_role_key)
    return _client
