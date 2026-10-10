import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    business_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    # server_default mirrors docs/03-schema.md so rows inserted outside the ORM get them too
    receipt_prefix: Mapped[str] = mapped_column(Text, nullable=False, default="R-", server_default="R-")
    numbering_mode: Mapped[str] = mapped_column(
        Text, nullable=False, default="sequential", server_default="sequential"
    )
    receipt_next_seq: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("numbering_mode IN ('sequential', 'nanoid')", name="users_numbering_mode_check"),
    )
