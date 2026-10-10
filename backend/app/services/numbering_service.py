"""Customer-facing receipt numbers (Architecture rule 7).

- sequential: atomic UPDATE users SET receipt_next_seq = receipt_next_seq + 1
  ... RETURNING -> f"{prefix}{seq:04d}". Numbers already taken by a manual
  override are skipped, so auto-numbering never collides with them.
- nanoid: 10 random uppercase alphanumerics.
- override: a client-supplied number is used as-is if unused (else
  ReceiptNumberTakenError -> 409) and does not consume the sequence.

GST tax invoices use their own series instead (CGST rule 46(b)): consecutive
and unique within a financial year, at most 16 characters of letters, digits,
"-" and "/": f"{invoice_prefix}{FY}/{seq:04d}", e.g. INV/26-27/0001. Each
financial year (invoice_series row) starts again at 1.

assign_number() runs inside the caller's transaction: if creating the receipt
fails and rolls back, the sequence isn't consumed either.
"""
import datetime as dt
import secrets
import string
from typing import Any, Literal

from sqlalchemy import exists, select, update
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import InvoiceSeries
from app.models.receipt import Receipt
from app.models.user import User
from app.services import gst_service

NANOID_ALPHABET = string.digits + string.ascii_uppercase
NANOID_LENGTH = 10
# Bounds the skip-over-taken loops; hitting it means something is badly wrong
MAX_ATTEMPTS = 1000


class ReceiptNumberTakenError(Exception):
    def __init__(self, number: str) -> None:
        super().__init__(number)
        self.number = number


class NumberingExhaustedError(Exception):
    pass


class InvoiceNumberInvalidError(ValueError):
    """Not a valid GST invoice number (too long, or characters rule 46 doesn't allow)."""


def upsert(db: AsyncSession, model: Any) -> Any:
    """INSERT ... ON CONFLICT for whichever database the session uses."""
    dialect = db.get_bind().dialect.name
    return (postgresql.insert if dialect == "postgresql" else sqlite.insert)(model)


def format_sequential(prefix: str, seq: int) -> str:
    return f"{prefix}{seq:04d}"


def generate_nanoid() -> str:
    return "".join(secrets.choice(NANOID_ALPHABET) for _ in range(NANOID_LENGTH))


async def is_taken(db: AsyncSession, user: User, number: str) -> bool:
    query = select(
        exists().where(Receipt.user_id == user.id, Receipt.receipt_number == number)
    )
    return bool((await db.execute(query)).scalar())


async def _take_next_sequential(db: AsyncSession, user: User) -> str:
    for _ in range(MAX_ATTEMPTS):
        result = await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(receipt_next_seq=User.receipt_next_seq + 1)
            .returning(User.receipt_next_seq, User.receipt_prefix)
        )
        seq_after, prefix = result.one()
        number = format_sequential(prefix, seq_after - 1)
        if not await is_taken(db, user, number):
            return number
    raise NumberingExhaustedError


async def _new_nanoid(db: AsyncSession, user: User) -> str:
    for _ in range(MAX_ATTEMPTS):
        number = generate_nanoid()
        if not await is_taken(db, user, number):
            return number
    raise NumberingExhaustedError


async def assign_number(db: AsyncSession, user: User, override: str | None) -> str:
    if override:
        if await is_taken(db, user, override):
            raise ReceiptNumberTakenError(override)
        return override
    if user.numbering_mode == "nanoid":
        return await _new_nanoid(db, user)
    return await _take_next_sequential(db, user)


def _invoice_number(user: User, financial_year: int, seq: int) -> str:
    number = gst_service.format_invoice_number(user.invoice_prefix, financial_year, seq)
    if len(number) > gst_service.INVOICE_NUMBER_MAX_LENGTH:
        raise InvoiceNumberInvalidError(
            f"Invoice {number} would be longer than {gst_service.INVOICE_NUMBER_MAX_LENGTH} "
            "characters. Shorten the invoice prefix in Settings."
        )
    return number


async def _take_next_invoice(db: AsyncSession, user: User, financial_year: int) -> str:
    for _ in range(MAX_ATTEMPTS):
        # Atomic: creates the year's series at 1, or takes its next number
        statement = (
            upsert(db, InvoiceSeries)
            .values(user_id=user.id, financial_year=financial_year, next_seq=2)
            .on_conflict_do_update(
                index_elements=[InvoiceSeries.user_id, InvoiceSeries.financial_year],
                set_={"next_seq": InvoiceSeries.next_seq + 1},
            )
            .returning(InvoiceSeries.next_seq)
        )
        seq_after = (await db.execute(statement)).scalar_one()
        number = _invoice_number(user, financial_year, seq_after - 1)
        if not await is_taken(db, user, number):
            return number
    raise NumberingExhaustedError


async def assign_invoice_number(db: AsyncSession, user: User, override: str | None, day: dt.date) -> str:
    """A GST invoice number in the series of the invoice date's financial year."""
    if override:
        if not gst_service.INVOICE_NUMBER_PATTERN.match(override):
            raise InvoiceNumberInvalidError(
                "A GST invoice number is at most 16 characters: letters, digits, - and / only."
            )
        if await is_taken(db, user, override):
            raise ReceiptNumberTakenError(override)
        return override
    return await _take_next_invoice(db, user, gst_service.financial_year(day))


async def preview_next_invoice_number(db: AsyncSession, user: User, day: dt.date) -> str:
    """What a blank GST invoice number dated `day` would get, without consuming it."""
    financial_year = gst_service.financial_year(day)
    stored = await db.execute(
        select(InvoiceSeries.next_seq).where(
            InvoiceSeries.user_id == user.id, InvoiceSeries.financial_year == financial_year
        )
    )
    seq = stored.scalar_one_or_none() or 1
    for _ in range(MAX_ATTEMPTS):
        number = gst_service.format_invoice_number(user.invoice_prefix, financial_year, seq)
        if not await is_taken(db, user, number):
            return number
        seq += 1
    raise NumberingExhaustedError


IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
PreviewMode = Literal["sequential", "nanoid", "invoice_series"]


async def preview(
    db: AsyncSession, user: User, gst_invoice: bool, day: dt.date | None
) -> tuple[PreviewMode, str | None]:
    """The numbering mode and next number for a receipt (or a GST invoice dated `day`)."""
    if gst_invoice:
        return "invoice_series", await preview_next_invoice_number(db, user, day or dt.datetime.now(IST).date())
    mode: PreviewMode = "nanoid" if user.numbering_mode == "nanoid" else "sequential"
    return mode, await preview_next_number(db, user)


async def preview_next_number(db: AsyncSession, user: User) -> str | None:
    """What a blank number would get right now, without consuming anything."""
    if user.numbering_mode == "nanoid":
        return None
    seq = user.receipt_next_seq
    for _ in range(MAX_ATTEMPTS):
        number = format_sequential(user.receipt_prefix, seq)
        if not await is_taken(db, user, number):
            return number
        seq += 1
    raise NumberingExhaustedError
