import os
from urllib.parse import urlparse


def database_url(value):
    # Hosting providers use these schemes; our installed driver is psycopg 3.
    for prefix in ("postgres://", "postgresql://"):
        if value.startswith(prefix):
            return "postgresql+psycopg://" + value[len(prefix) :]
    return value


def validate_deployment():
    mode = os.getenv("APP_MODE", "demo")
    if mode not in {"demo", "clinical"}:
        raise RuntimeError("APP_MODE must be demo or clinical")
    if mode == "clinical" and os.getenv("APP_ENV", "development") != "development":
        if not database_url(os.getenv("DATABASE_URL", "")).startswith("postgresql+psycopg://"):
            raise RuntimeError("Clinical deployment requires a configured PostgreSQL database")
        if not os.getenv("STORAGE_ENCRYPTION_KEY"):
            raise RuntimeError("Clinical deployment requires STORAGE_ENCRYPTION_KEY")
        url = urlparse(os.getenv("PUBLIC_API_URL", ""))
        if url.scheme != "https" or not url.hostname or url.hostname in {"localhost", "127.0.0.1"}:
            raise RuntimeError("Clinical deployment requires PUBLIC_API_URL with HTTPS")
