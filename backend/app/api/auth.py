from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models.user import User
from app.schemas.auth import AccountUpdate, Token, UserCreate, UserResponse
from app.services import auth_service

router = APIRouter()
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
        raise HTTPException(status_code=400, detail="Incorrect email or password")
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
