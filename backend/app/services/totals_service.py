"""Receipt money, computed server-side with Decimal only (Architecture rule 5).

Rules (mirrored by frontend/src/lib/money.ts for the live preview; both are
checked against shared/fixtures/totals_cases.json):
  line_total = round(qty * unit_price)
  subtotal   = sum(line_totals)
  taxable    = subtotal - discount          (discount may not exceed subtotal)
  tax        = round(taxable * tax_rate)
  total      = taxable + tax
Every amount rounds half-up to cents. The subtotal and total may not exceed
MAX_AMOUNT, the largest receipts.total_amount NUMERIC(12, 2) can store.
"""
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")
ZERO = Decimal("0.00")
MAX_AMOUNT = Decimal("9999999999.99")  # NUMERIC(12, 2)


class DiscountTooLargeError(ValueError):
    pass


class AmountTooLargeError(ValueError):
    pass


def to_cents(amount: Decimal) -> Decimal:
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class LineInput:
    qty: Decimal
    unit_price: Decimal


@dataclass(frozen=True)
class Totals:
    line_totals: list[Decimal]
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal


def compute_totals(items: Sequence[LineInput], tax_rate: Decimal, discount: Decimal) -> Totals:
    line_totals = [to_cents(item.qty * item.unit_price) for item in items]
    subtotal = sum(line_totals, ZERO)
    discount = to_cents(discount)
    if discount > subtotal:
        raise DiscountTooLargeError("The discount can't be more than the subtotal.")
    taxable = subtotal - discount
    tax = to_cents(taxable * tax_rate)
    if subtotal > MAX_AMOUNT or taxable + tax > MAX_AMOUNT:
        raise AmountTooLargeError(f"The total can't be more than {MAX_AMOUNT:,}.")
    return Totals(
        line_totals=line_totals,
        subtotal=subtotal,
        discount=discount,
        tax=tax,
        total=taxable + tax,
    )
