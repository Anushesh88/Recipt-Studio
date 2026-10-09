import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.models import Base


@pytest.mark.asyncio
async def test_user_numbering_defaults_are_server_side() -> None:
    # A raw INSERT (no ORM defaults) must still get the documented defaults
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text("INSERT INTO users (id, email, password_hash) VALUES (:id, :email, 'x')"),
            {"id": uuid.uuid4().hex, "email": "raw@example.com"},
        )
        row = (
            await conn.execute(
                text("SELECT receipt_prefix, numbering_mode, receipt_next_seq FROM users")
            )
        ).one()
    await engine.dispose()
    assert tuple(row) == ("R-", "sequential", 1)
