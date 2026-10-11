"""The in-app Feedback button, and the page where admins read it."""
import datetime as dt
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, StringConstraints
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.core.db import get_db
from app.core.rate_limit import SlidingWindowLimiter
from app.models.feedback import Feedback
from app.models.user import User

router = APIRouter()
feedback_limiter = SlidingWindowLimiter(10, 3600)  # per account per hour
LIST_LIMIT = 200


class FeedbackIn(BaseModel):
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    page: Annotated[str, StringConstraints(max_length=300)] | None = None


class FeedbackOut(BaseModel):
    id: uuid.UUID
    email: str
    message: str
    page: str | None
    created_at: dt.datetime | None

    model_config = ConfigDict(from_attributes=True)


@router.post("/feedback", status_code=status.HTTP_201_CREATED)
async def send_feedback(
    body: FeedbackIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> dict[str, str]:
    if feedback_limiter.hit(str(current_user.id)) is not None:
        raise HTTPException(status_code=429, detail="That's a lot of feedback! Please try again later.")
    db.add(Feedback(user_id=current_user.id, email=current_user.email, message=body.message, page=body.page))
    await db.commit()
    return {"message": "Thanks! Your feedback was sent."}


@router.get("/admin/feedback", response_model=list[FeedbackOut])
async def list_feedback(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[Feedback]:
    """Newest first. Only for the accounts in ADMIN_EMAILS."""
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can read feedback.")
    result = await db.execute(select(Feedback).order_by(Feedback.created_at.desc()).limit(LIST_LIMIT))
    return list(result.scalars().all())
