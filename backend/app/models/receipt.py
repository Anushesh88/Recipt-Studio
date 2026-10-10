import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from .base import Base

JsonType = JSON().with_variant(JSONB, 'postgresql')

class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("templates.id", ondelete="SET NULL"), nullable=True
    )
    # Canvas copy at generation time, so later template edits don't change it
    template_snapshot: Mapped[dict[str, Any]] = mapped_column(JsonType, nullable=False)
    data: Mapped[dict[str, Any]] = mapped_column(JsonType, nullable=False)
    # Customer-facing number (numbering_service), unique per user
    receipt_number: Mapped[str] = mapped_column(Text, nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    pdf_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    @property
    def customer_name(self) -> str | None:
        """For lists (History page); the full data lives in `data`."""
        name = (self.data.get("customer") or {}).get("name")
        return name if isinstance(name, str) else None

    __table_args__ = (
        UniqueConstraint("user_id", "receipt_number", name="uq_receipts_user_id_receipt_number"),
        Index("ix_receipts_user_id_created_at", "user_id", "created_at"),
    )
