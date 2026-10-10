"""PDF / PNG exports of stored receipts, and previews of unsaved ones."""
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.receipt import Receipt
from app.models.user import User
from app.schemas.canvas import Canvas
from app.schemas.receipt import ReceiptDataIn, ReceiptDataOut
from app.services import (
    numbering_service,
    receipt_service,
    render_service,
    totals_service,
)

ExportFormat = Literal["pdf", "png"]
PreviewFormat = Literal["pdf", "png", "html"]

MEDIA_TYPES = {"pdf": "application/pdf", "png": "image/png", "html": "text/html; charset=utf-8"}

# Part of the cached PDF's file name: bump it when rendering changes so stored
# receipts are re-rendered instead of served from an outdated cache
RENDER_VERSION = 1


@dataclass(frozen=True)
class ExportFile:
    content: bytes
    media_type: str
    filename: str


def _safe_filename(number: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", number).strip("._") or "receipt"


def content_from_stored(data: ReceiptDataOut, receipt_number: str) -> render_service.ReceiptContent:
    return render_service.ReceiptContent(
        values=receipt_service.variable_values(data, receipt_number),
        rows=[
            {
                "description": item.description,
                "qty": str(item.qty),
                "unit_price": str(item.unit_price),
                "line_total": str(item.line_total),
            }
            for item in data.items
        ],
        totals={key: str(value) for key, value in data.computed.model_dump().items()},
    )


async def _receipt_pdf(db: AsyncSession, user: User, receipt: Receipt) -> bytes:
    relative = Path(str(user.id)) / f"{receipt.id}-v{RENDER_VERSION}.pdf"
    cached = settings.RECEIPT_STORAGE_DIR / relative
    if receipt.pdf_path == relative.as_posix() and cached.is_file():
        return cached.read_bytes()

    # Rendered from the snapshot taken at generation time, so later template
    # edits never change an issued receipt
    data = ReceiptDataOut.model_validate(receipt.data)
    assets = await render_service.asset_sources(db, user, receipt.template_snapshot)
    html, _ = render_service.build_html(
        receipt.template_snapshot, content_from_stored(data, receipt.receipt_number), assets
    )
    pdf = await render_service.render_pdf_async(html)

    cached.parent.mkdir(parents=True, exist_ok=True)
    cached.write_bytes(pdf)
    receipt.pdf_path = relative.as_posix()
    await db.commit()
    return pdf


async def export_receipt(db: AsyncSession, user: User, receipt: Receipt, fmt: ExportFormat) -> ExportFile:
    pdf = await _receipt_pdf(db, user, receipt)
    body = pdf if fmt == "pdf" else await render_service.pdf_to_png_async(pdf)
    return ExportFile(body, MEDIA_TYPES[fmt], f"receipt-{_safe_filename(receipt.receipt_number)}.{fmt}")


async def preview(
    db: AsyncSession, user: User, canvas: Canvas, data: ReceiptDataIn, fmt: PreviewFormat
) -> ExportFile:
    """Renders a canvas + data without saving anything or consuming a number."""
    totals = totals_service.compute_totals(
        [totals_service.LineInput(qty=i.qty, unit_price=i.unit_price) for i in data.items],
        tax_rate=data.tax_rate,
        discount=data.discount,
    )
    number = data.receipt.number or await numbering_service.preview_next_number(db, user) or ""
    content = render_service.ReceiptContent(
        values=receipt_service.variable_values(data, number),
        rows=[
            {
                "description": item.description,
                "qty": str(item.qty),
                "unit_price": str(item.unit_price),
                "line_total": str(line_total),
            }
            for item, line_total in zip(data.items, totals.line_totals, strict=True)
        ],
        totals={
            "subtotal": str(totals.subtotal),
            "tax": str(totals.tax),
            "discount": str(totals.discount),
            "total": str(totals.total),
        },
    )
    canvas_json = canvas.model_dump(mode="json")
    assets = await render_service.asset_sources(db, user, canvas_json)
    html, _ = render_service.build_html(canvas_json, content, assets)
    if fmt == "html":
        return ExportFile(html.encode("utf-8"), MEDIA_TYPES["html"], "preview.html")
    pdf = await render_service.render_pdf_async(html)
    body = pdf if fmt == "pdf" else await render_service.pdf_to_png_async(pdf)
    return ExportFile(body, MEDIA_TYPES[fmt], f"preview.{fmt}")
