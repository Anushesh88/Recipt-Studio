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
    # None for accounts made with "Sign in with Google" (they have no password)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Google's stable account ID ("sub"), once the account has signed in with Google
    google_sub: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True)
    business_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    # server_default mirrors docs/03-schema.md so rows inserted outside the ORM get them too
    receipt_prefix: Mapped[str] = mapped_column(Text, nullable=False, default="R-", server_default="R-")
    numbering_mode: Mapped[str] = mapped_column(
        Text, nullable=False, default="sequential", server_default="sequential"
    )
    receipt_next_seq: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default=text("1")
    )
    # GST tax invoices (rule 46(a)): the supplier's address and GSTIN, and the
    # prefix of the per-financial-year invoice series (invoice_series)
    business_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    gstin: Mapped[str | None] = mapped_column(Text, nullable=True)
    invoice_prefix: Mapped[str] = mapped_column(Text, nullable=False, default="INV/", server_default="INV/")
    # What the user mostly makes, asked once after sign-up (None = not asked yet):
    # "receipts", "gst" or "both". Shapes defaults only; nothing is locked
    invoicing_mode: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    @property
    def has_password(self) -> bool:
        return self.password_hash is not None

    @property
    def google_linked(self) -> bool:
        return self.google_sub is not None

    __table_args__ = (
        CheckConstraint("numbering_mode IN ('sequential', 'nanoid')", name="users_numbering_mode_check"),
        CheckConstraint("invoicing_mode IN ('receipts', 'gst', 'both')", name="users_invoicing_mode_check"),
    )
