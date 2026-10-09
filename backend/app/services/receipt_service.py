"""Generating receipts from a template + data (POST /receipts)."""
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.receipt import Receipt
from app.models.user import User
from app.schemas.canvas import Canvas
from app.schemas.receipt import (
    ComputedTotals,
    LineItemOut,
    ReceiptCreate,
    ReceiptDataIn,
    ReceiptDataOut,
)
from app.services import (
    numbering_service,
    template_service,
    totals_service,
    variables_service,
)


class TemplateNotFoundError(Exception):
    pass


class MissingVariablesError(Exception):
    def __init__(self, missing: list[str]) -> None:
        super().__init__(", ".join(missing))
        self.missing = missing


def variable_values(data: ReceiptDataIn, receipt_number: str | None) -> dict[str, str]:
    """Flat {variable key: value} map for the variables a template can use."""
    values = {
        "business.name": data.business.name or "",
        "customer.name": data.customer.name or "",
        "customer.email": data.customer.email or "",
        "receipt.number": receipt_number or "",
        "receipt.date": data.receipt.date.isoformat() if data.receipt.date else "",
        "receipt.payment_method": data.receipt.payment_method or "",
        "receipt.currency": data.receipt.currency,
        "receipt.notes": data.receipt.notes or "",
    }
    values.update({f"{variables_service.CUSTOM_PREFIX}{key}": value for key, value in data.custom.items()})
    return values


async def create_receipt(db: AsyncSession, user: User, payload: ReceiptCreate) -> Receipt:
    template = await template_service.get_template(db, user, payload.template_id)
    if template is None:
        raise TemplateNotFoundError
    snapshot = Canvas.model_validate(template.canvas)
    data = payload.data

    # Every variable the template uses needs a value (Architecture rule 9)
    used = variables_service.extract_variables(template.canvas.get("elements", []))
    missing = variables_service.missing_required(used, variable_values(data, None))
    if missing:
        raise MissingVariablesError(missing)

    totals = totals_service.compute_totals(
        [totals_service.LineInput(qty=i.qty, unit_price=i.unit_price) for i in data.items],
        tax_rate=data.tax_rate,
        discount=data.discount,
    )

    # Last, so a rejected request never consumes a sequence number
    number = await numbering_service.assign_number(db, user, data.receipt.number or None)

    stored = ReceiptDataOut(
        business=data.business,
        customer=data.customer,
        receipt=data.receipt.model_copy(update={"number": number}),
        custom=data.custom,
        items=[
            LineItemOut(**item.model_dump(), line_total=line_total)
            for item, line_total in zip(data.items, totals.line_totals, strict=True)
        ],
        tax_rate=data.tax_rate,
        discount=totals.discount,
        computed=ComputedTotals(
            subtotal=totals.subtotal, tax=totals.tax, discount=totals.discount, total=totals.total
        ),
    )
    receipt = Receipt(
        user_id=user.id,
        template_id=template.id,
        template_snapshot=snapshot.model_dump(mode="json"),
        data=stored.model_dump(mode="json"),
        receipt_number=number,
        total_amount=totals.total,
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
