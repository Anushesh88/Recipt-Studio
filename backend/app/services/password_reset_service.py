"""Forgot password: a signed, one-hour link that sets a new password.

The link carries a token naming the account and a fingerprint of its current
password, so it stops working once the password changes (it can only be used
once) and when it expires.
"""
import hashlib
import html
import logging
import uuid
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from app.services import email_service

logger = logging.getLogger(__name__)
PURPOSE = "password_reset"


def _fingerprint(user: User) -> str:
    return hashlib.sha256((user.password_hash or "").encode()).hexdigest()[:16]


def make_token(user: User) -> str:
    expires = datetime.now(UTC) + timedelta(minutes=settings.PASSWORD_RESET_MINUTES)
    claims = {"sub": str(user.id), "purpose": PURPOSE, "pwd": _fingerprint(user), "exp": expires}
    return str(jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.ALGORITHM))


def reset_link(token: str) -> str:
    return f"{settings.PUBLIC_APP_URL.rstrip('/')}/reset-password?token={token}"


async def user_for_token(db: AsyncSession, token: str) -> User | None:
    """The account a still-valid reset token is for."""
    try:
        claims = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = uuid.UUID(str(claims.get("sub")))
    except (JWTError, ValueError):
        return None
    if claims.get("purpose") != PURPOSE:
        return None  # e.g. a login token, signed with the same key
    user = await db.get(User, user_id)
    if user is None or claims.get("pwd") != _fingerprint(user):
        return None  # the password changed since: already used
    return user


async def set_password(db: AsyncSession, user: User, password: str) -> None:
    user.password_hash = get_password_hash(password)
    await db.commit()


def _email(user: User, link: str) -> email_service.Email:
    minutes = settings.PASSWORD_RESET_MINUTES
    text = (
        "Someone (hopefully you) asked to reset your Receipt Studio password.\n\n"
        f"Set a new password here (the link works for {minutes} minutes, once):\n{link}\n\n"
        "If you didn't ask for this, ignore this email; your password stays the same."
    )
    safe = html.escape(link, quote=True)
    page = (
        '<div style="font-family: Arial, sans-serif; font-size: 15px; color: #111827; max-width: 480px">'
        '<p style="font-size: 18px; font-weight: bold">Receipt <span style="color: #4338CA">Studio</span></p>'
        "<p>Someone (hopefully you) asked to reset your Receipt Studio password.</p>"
        f'<p><a href="{safe}" style="display: inline-block; background: #4338CA; color: #ffffff; padding: 10px 18px; '
        'border-radius: 8px; text-decoration: none">Set a new password</a></p>'
        # Brevo may route the button through its click tracker, which some
        # networks block; the address as text is never rewritten
        '<p style="color: #6B7280; font-size: 13px">If the button doesn\'t open, copy this address into your browser:<br>'
        f'<span style="color: #111827; word-break: break-all">{safe}</span></p>'
        f"<p style=\"color: #6B7280; font-size: 13px\">The link works for {minutes} minutes, once. If you didn't ask "
        "for this, ignore this email; your password stays the same.</p></div>"
    )
    return email_service.Email(to=user.email, subject="Reset your Receipt Studio password", text=text, html=page)


async def send_reset_email(user: User) -> None:
    link = reset_link(make_token(user))
    if not email_service.configured() and settings.APP_ENV == "development":
        # Local development without Brevo: the link goes to the server log
        logger.warning("Password reset link for %s (email isn't set up): %s", user.email, link)
        return
    await email_service.send(_email(user, link))
