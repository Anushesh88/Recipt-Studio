from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from jose import jwt

from app.core.config import settings


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
