"""Sending email (password reset links) through Brevo's HTTPS API.

Free hosts such as Render block the SMTP ports, so mail goes over HTTPS.
Needs BREVO_API_KEY and EMAIL_FROM (a sender verified in Brevo).
"""
import json
import logging
import urllib.request
from dataclasses import dataclass

from fastapi.concurrency import run_in_threadpool

from app.core.config import settings

logger = logging.getLogger(__name__)
BREVO_URL = "https://api.brevo.com/v3/smtp/email"
TIMEOUT_SECONDS = 15


class EmailNotConfiguredError(Exception):
    pass


class EmailSendError(Exception):
    pass


@dataclass(frozen=True)
class Email:
    to: str
    subject: str
    text: str
    html: str


def configured() -> bool:
    return bool(settings.BREVO_API_KEY and settings.EMAIL_FROM)


def _post(email: Email) -> None:
    body = json.dumps({
        "sender": {"email": settings.EMAIL_FROM, "name": settings.EMAIL_FROM_NAME},
        "to": [{"email": email.to}],
        "subject": email.subject,
        "textContent": email.text,
        "htmlContent": email.html,
    }).encode()
    request = urllib.request.Request(
        BREVO_URL, data=body, method="POST",
        headers={"api-key": settings.BREVO_API_KEY or "", "Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            if response.status >= 300:
                raise EmailSendError(f"Brevo answered {response.status}")
    except OSError as e:  # URLError / HTTPError / timeouts
        raise EmailSendError(str(e)) from None


async def send(email: Email) -> None:
    if not configured():
        raise EmailNotConfiguredError
    await run_in_threadpool(_post, email)
    logger.info("Sent %r to %s", email.subject, email.to)
