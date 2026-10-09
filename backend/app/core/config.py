from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DB_PATH = BACKEND_DIR / "receipt.db"

class Settings(BaseSettings):
    DATABASE_URL: str = f"sqlite+aiosqlite:///{DEFAULT_DB_PATH}"
    SECRET_KEY: str = "supersecretkey-dev"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week

    # Uploaded logos/signatures (PNG/JPG only, docs/01-prd.md)
    ASSET_STORAGE_DIR: Path = BACKEND_DIR / "storage" / "assets"
    MAX_ASSET_BYTES: int = 2 * 1024 * 1024

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
