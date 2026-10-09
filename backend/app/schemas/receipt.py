"""Receipt data (docs/03-schema.md "Receipt Data JSON").

Money is Decimal throughout and serializes as a string ("9.72"); the server
computes every line total and total itself (Architecture rule 5).
"""
import datetime as dt
import uuid
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from .canvas import Canvas
from .common import UtcDatetime

# NUMERIC(12, 2)
MAX_MONEY = Decimal("9999999999.99")
MAX_LINE_ITEMS = 200

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
CustomKey = Annotated[str, StringConstraints(pattern=r"^[a-z_]+$")]
CustomValue = Annotated[str, StringConstraints(max_length=500)]
ReceiptNumber = Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)]


class LineItemIn(BaseModel):
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    qty: Decimal = Field(gt=0, le=Decimal(1000000), decimal_places=3)
    unit_price: Decimal = Field(ge=0, le=MAX_MONEY, decimal_places=2)


class LineItemOut(LineItemIn):
    line_total: Decimal


class BusinessData(BaseModel):
    name: ShortText | None = None


class CustomerData(BaseModel):
    name: ShortText | None = None
    email: EmailStr | None = None


class ReceiptMeta(BaseModel):
    # Blank / null = assign automatically (numbering_service)
    number: ReceiptNumber | None = None
    date: dt.date | None = None
    payment_method: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] | None = None
    currency: str = Field(default="USD", pattern=r"^[A-Z]{3}$")
    notes: Annotated[str, StringConstraints(max_length=1000)] | None = None


class ReceiptDataIn(BaseModel):
    business: BusinessData = Field(default_factory=BusinessData)
    customer: CustomerData = Field(default_factory=CustomerData)
    receipt: ReceiptMeta = Field(default_factory=ReceiptMeta)
    custom: dict[CustomKey, CustomValue] = Field(default_factory=dict)
    items: list[LineItemIn] = Field(default_factory=list, max_length=MAX_LINE_ITEMS)
    # Fraction, e.g. 0.08 for 8%; applied after the discount
    tax_rate: Decimal = Field(default=Decimal(0), ge=0, le=1, decimal_places=4)
    # Absolute amount off the subtotal
    discount: Decimal = Field(default=Decimal("0.00"), ge=0, le=MAX_MONEY, decimal_places=2)


class ComputedTotals(BaseModel):
    subtotal: Decimal
    tax: Decimal
    discount: Decimal
    total: Decimal


class ReceiptDataOut(ReceiptDataIn):
    """Stored receipts.data: the input plus server-computed money and number."""
    items: list[LineItemOut] = Field(default_factory=list)  # type: ignore[assignment]
    computed: ComputedTotals


class ReceiptCreate(BaseModel):
    template_id: uuid.UUID
    data: ReceiptDataIn


class ReceiptSummary(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID | None
    receipt_number: str
    total_amount: Decimal
    currency: str
    created_at: UtcDatetime | None

    model_config = ConfigDict(from_attributes=True)


class ReceiptResponse(ReceiptSummary):
    data: ReceiptDataOut
    template_snapshot: Canvas


class NextNumberResponse(BaseModel):
    mode: Literal["sequential", "nanoid"]
    # None in nanoid mode: the id is random, so there's nothing to preview
    next_number: str | None
