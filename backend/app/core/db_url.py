"""DATABASE_URL as hosts hand it out, made to work with SQLAlchemy + asyncpg.

Neon, Render, Supabase etc. give URLs like
    postgres://user:pass@host/db?sslmode=require&channel_binding=require
asyncpg needs the postgresql+asyncpg:// scheme and takes TLS as a connect
argument instead of libpq's sslmode / channel_binding parameters.
"""
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

LIBPQ_ONLY = {"sslmode", "channel_binding"}
TLS_MODES = {"require", "verify-ca", "verify-full"}


def engine_options(url: str) -> tuple[str, dict[str, Any]]:
    """(SQLAlchemy URL, connect_args) for a database URL."""
    parts = urlsplit(url)
    scheme = parts.scheme
    if scheme in ("postgres", "postgresql"):
        scheme = "postgresql+asyncpg"
    if scheme != "postgresql+asyncpg":
        return url, {}  # SQLite (local development) and anything else as given

    query = dict(parse_qsl(parts.query))
    connect_args: dict[str, Any] = {}
    if query.get("sslmode") in TLS_MODES:
        connect_args["ssl"] = "require"
    # Connection poolers (PgBouncer, e.g. Neon's "-pooler" hosts) can't keep
    # asyncpg's prepared statements between transactions
    if "-pooler." in (parts.hostname or "") or query.get("pgbouncer") == "true":
        connect_args["statement_cache_size"] = 0
    kept = urlencode({k: v for k, v in query.items() if k not in LIBPQ_ONLY | {"pgbouncer"}})
    return urlunsplit((scheme, parts.netloc, parts.path, kept, parts.fragment)), connect_args
