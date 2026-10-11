import datetime as dt
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.canvas import DocumentType


class ReportItem(BaseModel):
    description: str
    unit: str | None
    quantity: Decimal
    amount: Decimal  # quantity x price, before discounts and tax
    receipts: int  # how many receipts it was on


class ReportTotals(BaseModel):
    subtotal: Decimal  # all items, before discounts
    discount: Decimal
    taxable: Decimal  # subtotal - discount
    tax: Decimal
    # GST invoices' tax split (SGST includes UTGST); other tax is tax - these
    cgst: Decimal
    sgst: Decimal
    igst: Decimal
    total: Decimal


class SalesReport(BaseModel):
    start: dt.date
    end: dt.date
    document_type: DocumentType | None
    currency: str | None  # None: nothing sold in the period
    currencies: list[str]  # every currency sold in, to switch between
    receipt_count: int
    items: list[ReportItem]
    totals: ReportTotals
