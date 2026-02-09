import os
from dotenv import load_dotenv


# Load local environment variables for backend runs (uvicorn, scripts).
load_dotenv()


def _get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)
    if value is None or value == "":
        return None
    return value


class Settings:
    def __init__(self) -> None:
        self.env = os.getenv("APP_ENV", "local")
        self.supabase_url = _get_env("SUPABASE_URL") or _get_env("VITE_SUPABASE_URL")
        self.supabase_service_role_key = _get_env("SUPABASE_SERVICE_ROLE_KEY")
        self.supabase_anon_key = _get_env("SUPABASE_ANON_KEY") or _get_env("VITE_SUPABASE_PUBLISHABLE_KEY")
        if not self.supabase_service_role_key and self.env == "local":
            # Local fallback to keep backend bootable with frontend-only env vars.
            self.supabase_service_role_key = self.supabase_anon_key
        self.cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
        self.allow_public_read = os.getenv("ALLOW_PUBLIC_READ", "false").lower() == "true"
        self.ingest_api_key = _get_env("INGEST_API_KEY")
        self.media_bucket = _get_env("MEDIA_BUCKET", "ingestion-media")

    def validate(self) -> None:
        missing = []
        if not self.supabase_url:
            missing.append("SUPABASE_URL")
        if not self.supabase_service_role_key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY")
        if missing:
            raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")


settings = Settings()
