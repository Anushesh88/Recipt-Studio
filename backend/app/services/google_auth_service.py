"""Sign in with Google: checks the ID token the browser got from Google
Identity Services ("credential") and returns who it's for.

The token is a JWT signed by Google. verify_oauth2_token checks the signature
against Google's published keys, the expiry, the issuer, and that it was made
for this app (audience = GOOGLE_CLIENT_ID).
"""
from dataclasses import dataclass
from typing import Any

from fastapi.concurrency import run_in_threadpool
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


class GoogleTokenError(Exception):
    """Not a valid Google ID token for this app, or no verified email."""


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str  # Google's stable account ID
    email: str


def _verify(credential: str, client_id: str) -> dict[str, Any]:
    # Fetches Google's public keys over HTTPS, so it runs off the event loop
    claims = id_token.verify_oauth2_token(  # type: ignore[no-untyped-call]
        credential, google_requests.Request(), client_id
    )
    return dict(claims)


async def verify_credential(credential: str, client_id: str) -> GoogleIdentity:
    try:
        claims = await run_in_threadpool(_verify, credential, client_id)
    except ValueError as e:  # bad signature, expired, wrong audience or issuer
        raise GoogleTokenError(str(e)) from None
    sub, email = claims.get("sub"), claims.get("email")
    # Only an address Google has verified may sign in to (or link) an account
    if not isinstance(sub, str) or not isinstance(email, str) or claims.get("email_verified") is not True:
        raise GoogleTokenError("Google didn't confirm an email address for this account")
    return GoogleIdentity(sub=sub, email=email.strip().lower())
