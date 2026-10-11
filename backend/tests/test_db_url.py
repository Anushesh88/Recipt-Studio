"""Database URLs as hosts hand them out (core/db_url.py)."""
from app.core.db_url import engine_options


def test_hosted_postgres_urls_work_with_asyncpg() -> None:
    url, args = engine_options("postgresql://u:p@ep-cool-1.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require")
    assert url == "postgresql+asyncpg://u:p@ep-cool-1.ap-southeast-1.aws.neon.tech/neondb"
    assert args == {"ssl": "require"}

    assert engine_options("postgres://u:p@db.example.com:5432/app")[0] == "postgresql+asyncpg://u:p@db.example.com:5432/app"
    # Neon's pooled host: no prepared-statement cache
    pooled = engine_options("postgresql://u:p@ep-cool-1-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require")
    assert pooled == ("postgresql+asyncpg://u:p@ep-cool-1-pooler.ap-southeast-1.aws.neon.tech/neondb", {"ssl": "require", "statement_cache_size": 0})


def test_other_urls_are_left_alone() -> None:
    for url in ("sqlite+aiosqlite:///receipt.db", "postgresql+asyncpg://u:p@localhost/db"):
        assert engine_options(url) == (url, {})
    assert engine_options("postgresql://u:p@h/db?sslmode=disable&application_name=x") == (
        "postgresql+asyncpg://u:p@h/db?application_name=x", {}
    )
