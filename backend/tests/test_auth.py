from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User


async def test_register_and_login(client: AsyncClient) -> None:
    # Register user
    response = await client.post(
        "/auth/register",
        json={"email": "test@example.com", "password": "password123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data

    # Login user
    login_response = await client.post(
        "/auth/login",
        data={"username": "test@example.com", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_response.status_code == 200
    login_data = login_response.json()
    assert "access_token" in login_data
    assert login_data["token_type"] == "bearer"


async def test_register_duplicate_email(client: AsyncClient) -> None:
    await client.post(
        "/auth/register",
        json={"email": "duplicate@example.com", "password": "password123"},
    )
    # Try registering again
    response = await client.post(
        "/auth/register",
        json={"email": "duplicate@example.com", "password": "password123"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"


async def test_login_token_uses_configured_lifetime(client: AsyncClient) -> None:
    await client.post(
        "/auth/register", json={"email": "ttl@example.com", "password": "password123"}
    )
    response = await client.post(
        "/auth/login", data={"username": "ttl@example.com", "password": "password123"}
    )
    claims = jwt.decode(
        response.json()["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
    )
    lifetime = datetime.fromtimestamp(claims["exp"], UTC) - datetime.now(UTC)
    # Previously 15 minutes regardless of ACCESS_TOKEN_EXPIRE_MINUTES
    assert lifetime > timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES - 1)


async def test_passwords_need_8_characters_and_at_most_72_bytes(client: AsyncClient) -> None:
    async def register(email: str, password: str) -> int:
        return (await client.post("/auth/register", json={"email": email, "password": password})).status_code

    assert await register("empty@example.com", "") == 422
    assert await register("short@example.com", "1234567") == 422
    # bcrypt ignores bytes past 72, so longer passwords are refused, not cut short
    assert await register("long@example.com", "p" * 73) == 422
    assert await register("rupee@example.com", "₹" * 25) == 422  # 75 bytes
    assert await register("ok@example.com", "p" * 72) == 200


async def test_emails_are_case_insensitive(client: AsyncClient) -> None:
    created = await client.post("/auth/register", json={"email": "Jane.Doe@Example.COM", "password": "password123"})
    assert created.status_code == 200
    assert created.json()["email"] == "jane.doe@example.com"

    login = await client.post("/auth/login", data={"username": "JANE.DOE@example.com", "password": "password123"})
    assert login.status_code == 200
    again = await client.post("/auth/register", json={"email": "jane.doe@example.com", "password": "password123"})
    assert again.status_code == 400


async def test_accounts_stored_with_capitals_can_still_sign_in(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    # Made before emails were stored lowercase
    async with session_factory() as db:
        db.add(User(email="Old.Timer@Example.com", password_hash=get_password_hash("password123")))
        await db.commit()
    login = await client.post("/auth/login", data={"username": "old.timer@example.com", "password": "password123"})
    assert login.status_code == 200
    taken = await client.post("/auth/register", json={"email": "old.timer@example.com", "password": "password123"})
    assert taken.status_code == 400
