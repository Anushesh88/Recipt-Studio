"""Sign in with Google (POST /auth/google). Google's token check is replaced by
a stub: the tests cover what the app does with the result."""
from typing import Any

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.services import google_auth_service

CLIENT_ID = "test-client.apps.googleusercontent.com"


@pytest.fixture
def google(monkeypatch: pytest.MonkeyPatch) -> dict[str, dict[str, Any]]:
    """Google sign-in switched on; maps a credential string to the claims
    Google would vouch for (anything else is an invalid token)."""
    tokens: dict[str, dict[str, Any]] = {}

    def verify(credential: str, client_id: str) -> dict[str, Any]:
        assert client_id == CLIENT_ID
        if credential not in tokens:
            raise ValueError("Token used too late")
        return tokens[credential]

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", CLIENT_ID)
    monkeypatch.setattr(google_auth_service, "_verify", verify)
    return tokens


def claims(sub: str, email: str, verified: bool = True) -> dict[str, Any]:
    return {"sub": sub, "email": email, "email_verified": verified, "iss": "https://accounts.google.com"}


async def sign_in(client: AsyncClient, credential: str) -> tuple[int, dict[str, Any]]:
    response = await client.post("/auth/google", json={"credential": credential})
    return response.status_code, response.json()


async def me(client: AsyncClient, token: str) -> dict[str, Any]:
    response = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data: dict[str, Any] = response.json()
    return data


async def test_the_button_is_offered_only_when_configured(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", None)
    assert (await client.get("/auth/providers")).json() == {"google_client_id": None}
    status, body = await sign_in(client, "anything")
    assert (status, body["detail"]["code"]) == (503, "GOOGLE_SIGN_IN_DISABLED")

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", CLIENT_ID)
    assert (await client.get("/auth/providers")).json() == {"google_client_id": CLIENT_ID}


async def test_a_new_google_user_gets_an_account_without_a_password(
    client: AsyncClient, google: dict[str, dict[str, Any]]
) -> None:
    google["t1"] = claims("google-1", "Asha@Gmail.com")
    status, body = await sign_in(client, "t1")
    assert status == 200
    account = await me(client, body["access_token"])
    assert account["email"] == "asha@gmail.com"
    assert (account["has_password"], account["google_linked"], account["invoicing_mode"]) == (False, True, None)

    # Signing in again (even after the Gmail address changed) is the same account
    google["t2"] = claims("google-1", "asha.new@gmail.com")
    status, again = await sign_in(client, "t2")
    assert status == 200
    assert (await me(client, again["access_token"]))["id"] == account["id"]

    # There's no password to sign in with, and the error says how to
    response = await client.post("/auth/login", data={"username": "asha@gmail.com", "password": "password123"})
    assert response.status_code == 400
    assert response.json()["detail"] == "This account signs in with Google."


async def test_an_existing_account_is_linked_and_its_password_retired(
    client: AsyncClient, google: dict[str, dict[str, Any]]
) -> None:
    # Registered with a password (emails aren't verified, so it may not be
    # the address's owner who did)
    await client.post("/auth/register", json={"email": "ravi@example.com", "password": "password123"})
    google["t"] = claims("google-2", "ravi@example.com")
    status, body = await sign_in(client, "t")
    assert status == 200
    account = await me(client, body["access_token"])
    assert (account["email"], account["has_password"], account["google_linked"]) == ("ravi@example.com", False, True)
    response = await client.post("/auth/login", data={"username": "ravi@example.com", "password": "password123"})
    assert response.status_code == 400


async def test_invalid_or_unverified_tokens_are_refused(
    client: AsyncClient, google: dict[str, dict[str, Any]]
) -> None:
    status, body = await sign_in(client, "forged")
    assert (status, body["detail"]["code"]) == (401, "GOOGLE_TOKEN_INVALID")

    google["unverified"] = claims("google-3", "someone@example.com", verified=False)
    status, body = await sign_in(client, "unverified")
    assert (status, body["detail"]["code"]) == (401, "GOOGLE_TOKEN_INVALID")

    response = await client.post("/auth/google", json={"credential": ""})
    assert response.status_code == 422


async def test_password_accounts_report_how_they_sign_in(
    client: AsyncClient, login: Any
) -> None:
    headers = await login("pw@example.com")
    account = (await client.get("/auth/me", headers=headers)).json()
    assert (account["has_password"], account["google_linked"]) == (True, False)
