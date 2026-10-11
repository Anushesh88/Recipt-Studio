from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.db_url import engine_options

_url, _connect_args = engine_options(settings.DATABASE_URL)
# pre_ping: hosted databases that sleep when idle (Neon) drop old connections
engine = create_async_engine(_url, echo=False, connect_args=_connect_args, pool_pre_ping=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
