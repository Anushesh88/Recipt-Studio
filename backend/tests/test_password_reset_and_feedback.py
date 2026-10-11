"""Forgot password (POST /auth/forgot-password, /auth/reset-password) and the
Feedback button (POST /feedback, GET /admin/feedback). Emails are captured
instead of sent."""
import re
from collections.abc import Awaitable, Callable, Iterator
from typing import Any, Self

import pytest
from httpx import AsyncClient
from jose import jwt

from app.api import auth as auth_api
from app.api import feedback as feedback_api
from app.core.config import settings
from app.services import email_service

Login = Callable[[str], Awaitable[dict[str, str]]]


@pytest.fixture
def outbox(monkeypatch: pytest.MonkeyPatch) -> Iterator[list[email_service.Email]]:
    """Email "set up", with sends captured here."""
    sent: list[email_service.Email] = []

    async def capture(email: email_service.Email) -> None:
        sent.append(email)

    monkeypatch.setattr(settings, "BREVO_API_KEY", "test-key")
    monkeypatch.setattr(settings, "EMAIL_FROM", "hello@example.com")
    monkeypatch.setattr(settings, "PUBLIC_APP_URL", "https://app.example.com")
    monkeypatch.setattr(email_service, "send", capture)
    auth_api.reset_by_email.reset()
    auth_api.reset_by_client.reset()
    yield sent
    auth_api.reset_by_email.reset()
    auth_api.reset_by_client.reset()


def link_token(email: email_service.Email) -> str:
    match = re.search(r"https://app\.example\.com/reset-password\?token=(\S+)", email.text)
    assert match, email.text
    return match.group(1)


async def can_log_in(client: AsyncClient, email: str, password: str) -> bool:
    response = await client.post("/auth/login", data={"username": email, "password": password})
    return response.status_code == 200


async def test_a_forgotten_password_is_reset_from_the_emailed_link(
    client: AsyncClient, login: Login, outbox: list[email_service.Email]
) -> None:
    await login("forgetful@example.com")  # password123
    response = await client.post("/auth/forgot-password", json={"email": "Forgetful@Example.com"})
    assert response.status_code == 200
    assert len(outbox) == 1
    email = outbox[0]
    assert (email.to, email.subject) == ("forgetful@example.com", "Reset your Receipt Studio password")
    token = link_token(email)
    assert token in email.html

    reset = await client.post("/auth/reset-password", json={"token": token, "password": "a-brand-new-password"})
    assert reset.status_code == 200
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {reset.json()['access_token']}"})
    assert me.json()["email"] == "forgetful@example.com"
    assert await can_log_in(client, "forgetful@example.com", "a-brand-new-password")
    assert not await can_log_in(client, "forgetful@example.com", "password123")

    # The link works once
    again = await client.post("/auth/reset-password", json={"token": token, "password": "yet-another-password"})
    assert (again.status_code, again.json()["detail"]["code"]) == (400, "RESET_LINK_INVALID")


async def test_unknown_emails_get_the_same_answer_and_no_email(
    client: AsyncClient, outbox: list[email_service.Email]
) -> None:
    response = await client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert response.status_code == 200
    assert response.json()["message"] == auth_api.FORGOT_MESSAGE
    assert outbox == []


async def test_bad_expired_or_foreign_tokens_are_refused(
    client: AsyncClient, login: Login, outbox: list[email_service.Email]
) -> None:
    headers = await login("guarded@example.com")
    bad = [
        "not-a-token",
        headers["Authorization"].removeprefix("Bearer "),  # a login token: same key, other purpose
        jwt.encode({"sub": "00000000-0000-0000-0000-000000000000", "purpose": "password_reset", "pwd": "x"},
                   settings.SECRET_KEY, algorithm=settings.ALGORITHM),
    ]
    await client.post("/auth/forgot-password", json={"email": "guarded@example.com"})
    claims = jwt.get_unverified_claims(link_token(outbox[0]))
    bad.append(jwt.encode({**claims, "exp": 1}, settings.SECRET_KEY, algorithm=settings.ALGORITHM))  # expired
    for token in bad:
        response = await client.post("/auth/reset-password", json={"token": token, "password": "long-enough-1"})
        assert response.status_code == 400, token
    short = await client.post("/auth/reset-password", json={"token": link_token(outbox[0]), "password": "short"})
    assert short.status_code == 422


async def test_reset_requests_are_rate_limited(client: AsyncClient, outbox: list[email_service.Email]) -> None:
    codes = [(await client.post("/auth/forgot-password", json={"email": "spam@example.com"})).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]


async def test_without_email_set_up_production_says_so(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "BREVO_API_KEY", None)
    monkeypatch.setattr(settings, "APP_ENV", "production")
    response = await client.post("/auth/forgot-password", json={"email": "someone@example.com"})
    assert (response.status_code, response.json()["detail"]["code"]) == (503, "EMAIL_NOT_CONFIGURED")


async def test_a_google_only_account_can_set_a_password_this_way(
    client: AsyncClient, outbox: list[email_service.Email], session_factory: Any
) -> None:
    from app.models.user import User

    async with session_factory() as session:
        session.add(User(email="googler@example.com", password_hash=None, google_sub="g-1"))
        await session.commit()
    await client.post("/auth/forgot-password", json={"email": "googler@example.com"})
    reset = await client.post("/auth/reset-password", json={"token": link_token(outbox[0]), "password": "now-with-a-password"})
    assert reset.status_code == 200
    assert await can_log_in(client, "googler@example.com", "now-with-a-password")


@pytest.fixture
def fresh_feedback_limit() -> Iterator[None]:
    feedback_api.feedback_limiter.reset()
    yield
    feedback_api.feedback_limiter.reset()


async def test_feedback_is_saved_and_only_admins_read_it(
    client: AsyncClient, login: Login, monkeypatch: pytest.MonkeyPatch, fresh_feedback_limit: None
) -> None:
    user = await login("tester@example.com")
    sent = await client.post("/feedback", headers=user, json={"message": "  The PDF button is hard to find  ", "page": "/history"})
    assert sent.status_code == 201
    assert (await client.post("/feedback", headers=user, json={"message": "   "})).status_code == 422
    assert (await client.post("/feedback", json={"message": "anonymous"})).status_code == 401

    assert (await client.get("/admin/feedback", headers=user)).status_code == 403
    assert (await client.get("/auth/me", headers=user)).json()["is_admin"] is False

    monkeypatch.setattr(settings, "ADMIN_EMAILS", "Boss@Example.com, other@example.com")
    admin = await login("boss@example.com")
    assert (await client.get("/auth/me", headers=admin)).json()["is_admin"] is True
    listed = (await client.get("/admin/feedback", headers=admin)).json()
    assert [(f["email"], f["message"], f["page"]) for f in listed] == [
        ("tester@example.com", "The PDF button is hard to find", "/history")
    ]


async def test_feedback_is_rate_limited(client: AsyncClient, login: Login, fresh_feedback_limit: None) -> None:
    user = await login("chatty@example.com")
    codes = [(await client.post("/feedback", headers=user, json={"message": f"note {i}"})).status_code for i in range(11)]
    assert codes == [201] * 10 + [429]


async def test_emails_go_to_brevo_over_https(monkeypatch: pytest.MonkeyPatch) -> None:
    import json
    import urllib.request

    seen: dict[str, Any] = {}

    class Reply:
        status = 201

        def __enter__(self) -> Self:
            return self

        def __exit__(self, *args: object) -> None:
            return None

    def fake_urlopen(request: urllib.request.Request, timeout: float) -> Reply:
        seen.update(url=request.full_url, headers=dict(request.header_items()), body=json.loads(request.data or b"{}"))
        return Reply()

    monkeypatch.setattr(settings, "BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setattr(settings, "EMAIL_FROM", "hello@example.com")
    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)
    await email_service.send(email_service.Email(to="a@example.com", subject="Hi", text="plain", html="<p>html</p>"))
    assert seen["url"] == "https://api.brevo.com/v3/smtp/email"
    assert seen["headers"]["Api-key"] == "xkeysib-test"
    assert seen["body"] == {
        "sender": {"email": "hello@example.com", "name": "Receipt Studio"}, "to": [{"email": "a@example.com"}],
        "subject": "Hi", "textContent": "plain", "htmlContent": "<p>html</p>",
    }

    monkeypatch.setattr(settings, "BREVO_API_KEY", None)
    with pytest.raises(email_service.EmailNotConfiguredError):
        await email_service.send(email_service.Email(to="a@example.com", subject="Hi", text="t", html="h"))
