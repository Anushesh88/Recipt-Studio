"""Sales report: what was sold over a period, item by item, with the totals.

Receipts count by their receipt date (the date printed on them), falling back
to when they were created. Amounts are only added up within one currency.
"""
import datetime as dt
from collections import Counter
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.receipt import Receipt
from app.models.user import User
from app.services import receipt_service

ZERO = Decimal(0)


def receipt_day(receipt: Receipt) -> dt.date | None:
    raw = (receipt.data.get("receipt") or {}).get("date")
    if isinstance(raw, str):
        try:
            return dt.date.fromisoformat(raw)
        except ValueError:
            pass
    return receipt.created_at.date() if receipt.created_at else None


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value)) if value is not None else ZERO
    except ArithmeticError:
        return ZERO


@dataclass
class ItemLine:
    description: str
    unit: str | None
    quantity: Decimal = ZERO
    amount: Decimal = ZERO  # qty x price, before discounts and tax
    receipts: set[str] = field(default_factory=set)


@dataclass
class Report:
    currency: str | None
    currencies: list[str]
    receipt_count: int
    items: list[ItemLine]
    totals: dict[str, Decimal]


async def sales_report(
    db: AsyncSession, user: User, start: dt.date, end: dt.date,
    currency: str | None = None, document_type: str | None = None,
) -> Report:
    in_period = [
        r for r in await receipt_service.list_receipts(db, user)
        if (day := receipt_day(r)) is not None and start <= day <= end
        and (document_type is None or r.document_type == document_type)
    ]
    counts = Counter(r.currency for r in in_period)
    chosen = currency.upper() if currency else (counts.most_common(1)[0][0] if counts else None)
    receipts = [r for r in in_period if r.currency == chosen]

    items: dict[tuple[str, str], ItemLine] = {}
    totals = dict.fromkeys(("subtotal", "discount", "taxable", "tax", "cgst", "sgst", "igst", "total"), ZERO)
    # Oldest first (list_receipts is newest first), so an item's name is
    # spelled as on its latest receipt
    for receipt in reversed(receipts):
        data = receipt.data
        for item in data.get("items") or []:
            description = str(item.get("description") or "").strip() or "(no description)"
            unit = (item.get("unit") or None) and str(item["unit"]).upper()
            line = items.setdefault((description.lower(), unit or ""), ItemLine(description, unit))
            line.description = description
            line.quantity += _money(item.get("qty"))
            line.amount += _money(item.get("line_total"))
            line.receipts.add(str(receipt.id))
        computed = data.get("computed") or {}
        for key in ("subtotal", "discount", "tax", "total"):
            totals[key] += _money(computed.get(key))
        gst = computed.get("gst") or {}
        for key in ("cgst", "sgst", "igst"):
            totals[key] += _money(gst.get(key))
    totals["taxable"] = totals["subtotal"] - totals["discount"]

    ranked = sorted(items.values(), key=lambda line: (-line.amount, line.description.lower()))
    return Report(chosen, sorted(counts), len(receipts), ranked, totals)
