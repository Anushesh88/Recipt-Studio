"""Customer-facing receipt numbers (Architecture rule 7).

- sequential: atomic UPDATE users SET receipt_next_seq = receipt_next_seq + 1
  ... RETURNING -> f"{prefix}{seq:04d}". Numbers already taken by a manual
  override are skipped, so auto-numbering never collides with them.
- nanoid: 10 random uppercase alphanumerics.
- override: a client-supplied number is used as-is if unused (else
  ReceiptNumberTakenError -> 409) and does not consume the sequence.

assign_number() runs inside the caller's transaction: if creating the receipt
fails and rolls back, the sequence isn't consumed either.
"""
import secrets
import string

from sqlalchemy import exists, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.receipt import Receipt
from app.models.user import User

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
