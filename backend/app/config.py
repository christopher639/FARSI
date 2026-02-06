import os


def _get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name, default)
    if value is None or value == "":
        return None
    return value


class Settings:
    def __init__(self) -> None:
        self.env = os.getenv("APP_ENV", "local")
        self.mongo_uri = _get_env("MONGODB_URI")
        self.mongo_db = _get_env("MONGODB_DB", "FARSI")
        self.jwt_secret = _get_env("JWT_SECRET")
        self.jwt_algorithm = _get_env("JWT_ALGORITHM", "HS256")
        self.jwt_exp_minutes = int(os.getenv("JWT_EXP_MINUTES", "60"))
        self.cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
        self.allow_public_read = os.getenv("ALLOW_PUBLIC_READ", "false").lower() == "true"
        self.media_storage_dir = _get_env("MEDIA_STORAGE_DIR", "data/uploads")
        self.admin_email = _get_env("ADMIN_EMAIL")
        self.admin_password = _get_env("ADMIN_PASSWORD")
        self.ingest_api_key = _get_env("INGEST_API_KEY")

    def validate(self) -> None:
        missing = []
        if not self.mongo_uri:
            missing.append("MONGODB_URI")
        if not self.jwt_secret:
            missing.append("JWT_SECRET")
        if missing:
            raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")


settings = Settings()
