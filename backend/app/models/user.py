import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.config import settings

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
    # Business profile: printed by templates through {{business.phone}} and the
    # like (lines whose profile details are empty are left out)
    business_phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    business_email: Mapped[str | None] = mapped_column(Text, nullable=True)
    upi_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    pan: Mapped[str | None] = mapped_column(Text, nullable=True)
    bank_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    licence: Mapped[str | None] = mapped_column(Text, nullable=True)  # e.g. "FSSAI 11521999000123"
    # Brand kit: the logo that templates' logo boxes show, a colour (#RRGGBB) and
    # a font pairing (BRAND_FONTS) that templates take on
    brand_logo_asset_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        # assets also point at users: created after both tables
        ForeignKey("assets.id", ondelete="SET NULL", use_alter=True, name="users_brand_logo_asset_id_fkey"),
        nullable=True,
    )
    brand_color: Mapped[str | None] = mapped_column(Text, nullable=True)
    brand_fonts: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    @property
    def has_password(self) -> bool:
        return self.password_hash is not None

    @property
    def google_linked(self) -> bool:
        return self.google_sub is not None

    @property
    def is_admin(self) -> bool:
        return self.email.lower() in settings.admin_emails

    __table_args__ = (
        CheckConstraint("numbering_mode IN ('sequential', 'nanoid')", name="users_numbering_mode_check"),
        CheckConstraint("invoicing_mode IN ('receipts', 'gst', 'both')", name="users_invoicing_mode_check"),
    )
