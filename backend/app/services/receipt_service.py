"""Generating receipts and GST tax invoices from a template + data (POST /receipts).

The template's documentType decides which: a plain receipt (totals_service) or
a GST tax invoice (gst_service, CGST rule 46), which takes the supplier's
name, address and GSTIN from the account and is numbered in the
per-financial-year invoice series.
"""
import datetime as dt
import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.receipt import Receipt
from app.models.user import User
from app.schemas.canvas import Canvas, DocumentType
from app.schemas.receipt import (
    ComputedTotals,
    GstComputed,
    LineItemOut,
    ReceiptCreate,
    ReceiptDataIn,
    ReceiptDataOut,
)
from app.services import (
    catalog_service,
    gst_service,
    layout_service,
    numbering_service,
    qr_service,
    template_service,
    totals_service,
    variables_service,
)

IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
ZERO = Decimal("0.00")

# On a GST invoice the buyer's details are required only by the rules in
# _check_buyer (registered buyer, or unregistered at Rs 50,000 or more), and the
# supplier's come from Settings
GST_OPTIONAL_VARIABLES = variables_service.OPTIONAL_VARIABLES | {
    "customer.name", "customer.address", "customer.gstin", "receipt.place_of_supply", "business.name",
}


class TemplateNotFoundError(Exception):
    pass


class MissingVariablesError(Exception):
    def __init__(self, missing: list[str]) -> None:
        super().__init__(", ".join(missing))
        self.missing = missing


class ReceiptRuleError(Exception):
    """Refused by the GST invoice rules: 422 {code, message, fields}."""

    def __init__(self, code: str, message: str, fields: list[str]) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.fields = fields


def variable_values(
    data: ReceiptDataIn, receipt_number: str | None, document_type: DocumentType = "receipt"
) -> dict[str, str]:
    """Flat {variable key: value} map for the variables a template can use."""
    gst = document_type == "gst_invoice"
    values = {
        "business.name": data.business.name or "",
        "business.address": data.business.address or "",
        "business.gstin": data.business.gstin or "",
        "customer.name": data.customer.name or "",
        "customer.email": data.customer.email or "",
        "customer.address": data.customer.address or "",
        # A GST invoice to a buyer without a GSTIN says so
        "customer.gstin": data.customer.gstin or (gst_service.UNREGISTERED if gst else ""),
        "receipt.number": receipt_number or "",
        "receipt.date": data.receipt.date.isoformat() if data.receipt.date else "",
        "receipt.payment_method": data.receipt.payment_method or "",
        "receipt.currency": data.receipt.currency,
        "receipt.notes": data.receipt.notes or "",
        "receipt.place_of_supply": gst_service.state_label(data.receipt.place_of_supply or ""),
        "receipt.reverse_charge": "Yes" if data.receipt.reverse_charge else "No",
    }
    values.update({f"{variables_service.CUSTOM_PREFIX}{key}": value for key, value in data.custom.items()})
    return values


@dataclass(frozen=True)
class Prepared:
    """Receipt data with the server's additions, ready to number and store."""
    data: ReceiptDataIn
    items: list[LineItemOut]
    computed: ComputedTotals


def _with_account_details(data: ReceiptDataIn, user: User, gst: bool) -> ReceiptDataIn:
    # The supplier's address and GSTIN always come from Settings; on a GST
    # invoice the name too, so it matches the registration
    business = data.business.model_copy(update={
        "address": user.business_address,
        "gstin": user.gstin,
        **({"name": user.business_name} if gst else {}),
    })
    return data.model_copy(update={"business": business})


def _prepare_receipt(data: ReceiptDataIn) -> Prepared:
    totals = totals_service.compute_totals(
        [totals_service.LineInput(qty=i.qty, unit_price=i.unit_price) for i in data.items],
        tax_rate=data.tax_rate,
        discount=data.discount,
    )
    # GST-only line fields don't apply to plain receipts
    plain = [i.model_copy(update={"hsn": None, "unit": None, "discount": ZERO, "gst_rate": None}) for i in data.items]
    return Prepared(
        data=data.model_copy(update={"items": plain, "discount": totals.discount}),
        items=[
            LineItemOut(**item.model_dump(), line_total=line_total)
            for item, line_total in zip(plain, totals.line_totals, strict=True)
        ],
        computed=ComputedTotals(subtotal=totals.subtotal, tax=totals.tax, discount=totals.discount, total=totals.total),
    )


def _require_gst_profile(user: User) -> str:
    """The supplier's state code; Settings must hold name, address and GSTIN."""
    if not (user.business_name and user.business_address and user.gstin):
        raise ReceiptRuleError(
            "GST_PROFILE_INCOMPLETE",
            "Add your business name, address and GSTIN in Settings before issuing GST invoices.",
            [],
        )
    return user.gstin[:2]


def _check_buyer(data: ReceiptDataIn, taxable: Decimal) -> None:
    """Rule 46(d)/(e) buyer details, and HSN codes on B2B invoices."""
    registered = bool(data.customer.gstin)
    required: list[str] = []
    if registered or taxable >= gst_service.UNREGISTERED_DETAILS_THRESHOLD:
        required += [f"customer.{key}" for key in ("name", "address") if not getattr(data.customer, key)]
    if registered:
        required += [f"items.{i}.hsn" for i, item in enumerate(data.items) if not item.hsn]
    if required:
        why = (
            "A GST invoice to a registered buyer needs their name and address, and an HSN/SAC code on every item."
            if registered else
            "An unregistered buyer's name and address (also the delivery address) are required "
            f"from a taxable value of Rs {gst_service.UNREGISTERED_DETAILS_THRESHOLD:,}."
        )
        raise ReceiptRuleError("GST_DETAILS_REQUIRED", why, required)


def _prepare_gst_invoice(data: ReceiptDataIn, user: User, strict: bool) -> Prepared:
    """GST totals per line. `strict` (creating, not previewing) also enforces rule 46's details."""
    supplier_state = _require_gst_profile(user) if strict else (user.gstin or "")[:2]
    if strict:
        if data.receipt.currency != "INR":
            raise ReceiptRuleError("GST_CURRENCY", "GST invoices are in Indian rupees (INR).", ["receipt.currency"])
        if data.tax_rate or data.discount:
            raise ReceiptRuleError(
                "GST_PER_ITEM", "On a GST invoice, the GST rate and any discount are set per item.",
                [field for field, value in (("tax_rate", data.tax_rate), ("discount", data.discount)) if value],
            )
        if not data.items:
            raise ReceiptRuleError("GST_DETAILS_REQUIRED", "A GST invoice needs at least one item.", ["items"])
        no_rate = [f"items.{i}.gst_rate" for i, item in enumerate(data.items) if item.gst_rate is None]
        if no_rate:
            raise ReceiptRuleError("GST_DETAILS_REQUIRED", "Every item needs its GST rate.", no_rate)

    buyer_state = data.customer.gstin[:2] if data.customer.gstin else supplier_state
    place = data.receipt.place_of_supply or buyer_state or None
    meta = data.receipt.model_copy(update={
        "place_of_supply": place,
        "date": data.receipt.date or dt.datetime.now(IST).date(),
    })
    data = data.model_copy(update={"receipt": meta, "tax_rate": ZERO, "discount": ZERO})

    try:
        totals = gst_service.compute_totals(
            [
                gst_service.GstLineInput(i.qty, i.unit_price, i.discount, i.gst_rate or ZERO)
                for i in data.items
            ],
            supplier_state=supplier_state,
            place_of_supply=place or supplier_state,
        )
    except gst_service.LineDiscountTooLargeError as e:
        raise ReceiptRuleError("DISCOUNT_TOO_LARGE", str(e), [f"items.{e.index}.discount"]) from None
    if totals.subtotal > totals_service.MAX_AMOUNT or totals.total > totals_service.MAX_AMOUNT:
        raise totals_service.AmountTooLargeError(f"The total can't be more than {totals_service.MAX_AMOUNT:,}.")
    if strict:
        _check_buyer(data, totals.taxable)

    return Prepared(
        data=data,
        items=[
            LineItemOut(
                **item.model_dump(), line_total=line.amount, taxable_value=line.taxable_value, tax_amount=line.tax
            )
            for item, line in zip(data.items, totals.lines, strict=True)
        ],
        computed=ComputedTotals(
            subtotal=totals.subtotal,
            tax=totals.tax,
            discount=totals.discount,
            total=totals.total,
            gst=GstComputed(
                supply=totals.supply,
                state_tax_label="UTGST" if totals.state_tax_label == "UTGST" else "SGST",
                taxable=totals.taxable,
                cgst=totals.cgst,
                sgst=totals.sgst,
                igst=totals.igst,
            ),
        ),
    )


def prepare(data: ReceiptDataIn, user: User, document_type: DocumentType, strict: bool = True) -> Prepared:
    gst = document_type == "gst_invoice"
    data = _with_account_details(data, user, gst)
    return _prepare_gst_invoice(data, user, strict) if gst else _prepare_receipt(data)


async def create_receipt(db: AsyncSession, user: User, payload: ReceiptCreate) -> Receipt:
    template = await template_service.get_template(db, user, payload.template_id)
    if template is None:
        raise TemplateNotFoundError
    snapshot = Canvas.model_validate(template.canvas)
    document_type = snapshot.documentType
    elements = template.canvas.get("elements", [])

    prepared = prepare(payload.data, user, document_type)
    data = prepared.data

    # Every variable the template uses needs a value (Architecture rule 9)
    used = variables_service.extract_variables(elements)
    optional = GST_OPTIONAL_VARIABLES if document_type == "gst_invoice" else variables_service.OPTIONAL_VARIABLES
    missing = variables_service.missing_required(used, variable_values(data, None, document_type), optional)
    if missing:
        raise MissingVariablesError(missing)

    # A receipt that can't be exported (too many items for a fixed page) is
    # refused up front rather than stored
    layout_service.ensure_fits(template.canvas["page"], elements, len(data.items))

    # Last, so a rejected request never consumes a sequence number
    override = data.receipt.number or None
    if document_type == "gst_invoice":
        day = data.receipt.date or dt.datetime.now(IST).date()  # prepare() sets it
        number = await numbering_service.assign_invoice_number(db, user, override, day)
    else:
        number = await numbering_service.assign_number(db, user, override)

    # QR codes hold limited text, so they're checked with the final number filled in
    try:
        qr_service.check_codes(elements, variable_values(data, number, document_type))
    except qr_service.QrContentTooLongError:
        await db.rollback()  # hands the sequence number back
        raise

    await catalog_service.remember(db, user, data)
    stored = ReceiptDataOut(
        business=data.business,
        customer=data.customer,
        receipt=data.receipt.model_copy(update={"number": number}),
        custom=data.custom,
        items=prepared.items,
        tax_rate=data.tax_rate,
        discount=prepared.computed.discount if document_type == "receipt" else ZERO,
        computed=prepared.computed,
    )
    receipt = Receipt(
        user_id=user.id,
        template_id=template.id,
        template_snapshot=snapshot.model_dump(mode="json"),
        data=stored.model_dump(mode="json"),
        receipt_number=number,
        document_type=document_type,
        total_amount=prepared.computed.total,
        currency=data.receipt.currency,
    )
    db.add(receipt)
    try:
        await db.commit()
    except IntegrityError:
        # A concurrent request took the same number between our check and insert
        await db.rollback()
        raise numbering_service.ReceiptNumberTakenError(number) from None
    await db.refresh(receipt)
    return receipt


async def list_receipts(db: AsyncSession, user: User) -> list[Receipt]:
    result = await db.execute(
        select(Receipt).where(Receipt.user_id == user.id).order_by(Receipt.created_at.desc())
    )
    return list(result.scalars().all())


async def get_receipt(db: AsyncSession, user: User, receipt_id: uuid.UUID) -> Receipt | None:
    result = await db.execute(
        select(Receipt).where(Receipt.id == receipt_id, Receipt.user_id == user.id)
    )
    return result.scalars().first()
