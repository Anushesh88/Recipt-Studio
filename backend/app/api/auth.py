import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.db import get_db
from app.core.rate_limit import SlidingWindowLimiter
from app.models.user import User
from app.schemas.auth import (
    AccountUpdate,
    AuthProviders,
    ForgotPassword,
    GoogleCredential,
    ResetPassword,
    Token,
    UserCreate,
    UserResponse,
)
from app.services import (
    auth_service,
    email_service,
    google_auth_service,
    password_reset_service,
)

router = APIRouter()
logger = logging.getLogger(__name__)

# Reset emails: a few per address, and per visitor, each hour
reset_by_email = SlidingWindowLimiter(3, 3600)
reset_by_client = SlidingWindowLimiter(20, 3600)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)], db: AsyncSession = Depends(get_db)
) -> User:
    user = await auth_service.user_from_token(db, token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
    try:
        return await auth_service.register_user(db, user_in.email, user_in.password)
    except auth_service.EmailTakenError:
        raise HTTPException(status_code=400, detail="Email already registered") from None


@router.post("/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: AsyncSession = Depends(get_db)
) -> Token:
    user = await auth_service.authenticate(db, form_data.username, form_data.password)
    if user is None:
        existing = await auth_service.get_user_by_email(db, form_data.username)
        if existing is not None and existing.password_hash is None:
            raise HTTPException(status_code=400, detail="This account signs in with Google.")
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    return Token(access_token=auth_service.issue_token(user), token_type="bearer")


@router.get("/providers", response_model=AuthProviders)
async def providers() -> AuthProviders:
    """The Google client ID for the sign-in button (None: no Google sign-in)."""
    return AuthProviders(google_client_id=settings.GOOGLE_CLIENT_ID or None)


@router.post("/google", response_model=Token)
async def google_sign_in(body: GoogleCredential, db: AsyncSession = Depends(get_db)) -> Token:
    """Signs in (or signs up) with a Google ID token from Google Identity Services."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail={"code": "GOOGLE_SIGN_IN_DISABLED", "message": "Sign in with Google isn't set up."},
        )
    try:
        identity = await google_auth_service.verify_credential(body.credential, settings.GOOGLE_CLIENT_ID)
    except google_auth_service.GoogleTokenError:
        raise HTTPException(
            status_code=401,
            detail={"code": "GOOGLE_TOKEN_INVALID", "message": "Google sign-in failed. Please try again."},
        ) from None
    user = await auth_service.google_sign_in(db, identity)
    return Token(access_token=auth_service.issue_token(user), token_type="bearer")


@router.get("/me", response_model=UserResponse)
async def read_account(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_account(
    changes: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Business name and receipt numbering (prefix, sequential or random IDs)."""
    return await auth_service.update_account(db, current_user, changes)


FORGOT_MESSAGE = "If an account uses that email, we've sent it a link to set a new password."


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPassword, request: Request, db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    """Emails a reset link. Says the same whether or not the account exists."""
    if not email_service.configured() and settings.APP_ENV != "development":
        raise HTTPException(
            status_code=503,
            detail={
                "code": "EMAIL_NOT_CONFIGURED",
                "message": "Password reset by email isn't set up yet. Please contact support.",
            },
        )
    client = request.client.host if request.client else "unknown"
    if reset_by_email.hit(body.email) is not None or reset_by_client.hit(client) is not None:
        raise HTTPException(
            status_code=429,
            detail={"code": "RATE_LIMITED", "message": "Too many reset requests. Please try again in an hour."},
        )
    user = await auth_service.get_user_by_email(db, body.email)
    if user is not None:
        try:
            await password_reset_service.send_reset_email(user)
        except email_service.EmailSendError:
            logger.exception("Couldn't send the password reset email")
    return {"message": FORGOT_MESSAGE}


@router.post("/reset-password", response_model=Token)
async def reset_password(body: ResetPassword, db: AsyncSession = Depends(get_db)) -> Token:
    """Sets a new password from an emailed link, and signs in."""
    user = await password_reset_service.user_for_token(db, body.token)
    if user is None:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "RESET_LINK_INVALID",
                "message": "This link has expired or was already used. Ask for a new one.",
            },
        )
    await password_reset_service.set_password(db, user, body.password)
    return Token(access_token=auth_service.issue_token(user), token_type="bearer")
