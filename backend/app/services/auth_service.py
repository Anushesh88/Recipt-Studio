"""Accounts: registration, login tokens, and per-user receipt settings."""
from datetime import timedelta

from jose import JWTError, jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import AccountUpdate


class EmailTakenError(Exception):
    pass


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Case-insensitive, so "Jane@Example.com" signs in to jane@example.com
    (accounts made before emails were stored lowercase included)."""
    result = await db.execute(select(User).where(func.lower(User.email) == email.strip().lower()))
    return result.scalars().first()


async def register_user(db: AsyncSession, email: str, password: str) -> User:
    if await get_user_by_email(db, email):
        raise EmailTakenError
    user = User(email=email.strip().lower(), password_hash=get_password_hash(password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, email: str, password: str) -> User | None:
    user = await get_user_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


def issue_token(user: User) -> str:
    # Without an explicit delta the token defaulted to 15 minutes, not the configured week
    return create_access_token(
        data={"email": user.email},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


async def user_from_token(db: AsyncSession, token: str) -> User | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    email = payload.get("email")
    return await get_user_by_email(db, email) if isinstance(email, str) else None


async def update_account(db: AsyncSession, user: User, changes: AccountUpdate) -> User:
    sent = changes.model_fields_set
    if "business_name" in sent:
        user.business_name = changes.business_name or None
    if "receipt_prefix" in sent and changes.receipt_prefix is not None:
        user.receipt_prefix = changes.receipt_prefix
    if "numbering_mode" in sent and changes.numbering_mode is not None:
        user.numbering_mode = changes.numbering_mode
    if "business_address" in sent:
        user.business_address = changes.business_address or None
    if "gstin" in sent:
        user.gstin = changes.gstin or None
    if "invoice_prefix" in sent and changes.invoice_prefix is not None:
        user.invoice_prefix = changes.invoice_prefix
    if "invoicing_mode" in sent and changes.invoicing_mode is not None:
        user.invoicing_mode = changes.invoicing_mode
    await db.commit()
    await db.refresh(user)
    return user
