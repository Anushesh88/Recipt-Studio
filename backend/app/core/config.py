from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DB_PATH = BACKEND_DIR / "receipt.db"

# Signs login tokens. This default is public (it's in the repository), so it's
# only accepted in development
DEV_SECRET_KEY = "supersecretkey-dev"
MIN_SECRET_KEY_LENGTH = 32

class Settings(BaseSettings):
    # Anything but "development" requires a real SECRET_KEY (the Docker image
    # defaults to "production")
    APP_ENV: Literal["development", "production"] = "development"
    DATABASE_URL: str = f"sqlite+aiosqlite:///{DEFAULT_DB_PATH}"
    SECRET_KEY: str = DEV_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    # OAuth client ID (Google Cloud console, "Web application") for "Sign in
    # with Google"; the button is hidden while this is unset
    GOOGLE_CLIENT_ID: str | None = None
    # Websites allowed to call the API from the browser, comma-separated, e.g.
    # "https://receipt-studio.vercel.app"; "*" (the default) allows any
    CORS_ORIGINS: str = "*"
    # The website's address, for links in emails (password reset)
    PUBLIC_APP_URL: str = "http://localhost:5173"

    # Email (password reset) through Brevo's HTTPS API: free hosts like Render
    # block the SMTP ports. Unset: no emails; in development the reset link is
    # written to the log instead
    BREVO_API_KEY: str | None = None
    EMAIL_FROM: str | None = None  # a sender address verified in Brevo
    EMAIL_FROM_NAME: str = "Receipt Studio"
    PASSWORD_RESET_MINUTES: int = 60

    # Error reports to Sentry (sentry.io > project > Client Keys); unset: off
    SENTRY_DSN: str | None = None

    # Accounts that can read feedback (/admin/feedback), comma-separated emails
    ADMIN_EMAILS: str = ""

    @property
    def admin_emails(self) -> set[str]:
        return {e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()}

    # Uploaded logos/signatures (PNG/JPG only, docs/01-prd.md)
    ASSET_STORAGE_DIR: Path = BACKEND_DIR / "storage" / "assets"
    MAX_ASSET_BYTES: int = 2 * 1024 * 1024

    # Rendered receipt PDFs, cached for re-download
    RECEIPT_STORAGE_DIR: Path = BACKEND_DIR / "storage" / "receipts"
    # Exports / previews per user per window (basic abuse protection)
    EXPORT_RATE_LIMIT: int = 30
    EXPORT_RATE_WINDOW_SECONDS: int = 60
    # Folder with WeasyPrint's GTK/Pango DLLs on Windows; the standard MSYS2
    # location (C:\msys64\mingw64\bin) is used automatically when present
    WEASYPRINT_DLL_DIRECTORIES: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @model_validator(mode="after")
    def require_real_secret_key(self) -> "Settings":
        if self.APP_ENV != "development" and (
            self.SECRET_KEY == DEV_SECRET_KEY or len(self.SECRET_KEY) < MIN_SECRET_KEY_LENGTH
        ):
            raise ValueError(
                f"Set SECRET_KEY to a random value of at least {MIN_SECRET_KEY_LENGTH} characters "
                f"(APP_ENV is {self.APP_ENV}). Generate one with: "
                'python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return self

settings = Settings()
