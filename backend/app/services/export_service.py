"""PDF / PNG exports of stored receipts, and previews of unsaved ones."""
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.receipt import Receipt
from app.models.user import User
from app.schemas.canvas import Canvas, DocumentType
from app.schemas.receipt import (
    ComputedTotals,
    LineItemOut,
    ReceiptDataIn,
    ReceiptDataOut,
)
from app.services import (
    gst_service,
    numbering_service,
    receipt_service,
    render_service,
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


def item_cells(item: LineItemOut) -> dict[str, str]:
    """A line item as table cells, keyed like the columns (mirrors lib/receiptContent.ts)."""
    return {
        "description": item.description,
        "qty": f"{item.qty} {item.unit}" if item.unit else str(item.qty),
        "unit_price": str(item.unit_price),
        "line_total": str(item.line_total),
        "hsn": item.hsn or "",
        "discount": str(item.discount) if item.discount else "",
        "taxable_value": "" if item.taxable_value is None else str(item.taxable_value),
        "gst_rate": "" if item.gst_rate is None else gst_service.format_rate(item.gst_rate),
        "tax_amount": "" if item.tax_amount is None else str(item.tax_amount),
    }


def totals_values(computed: ComputedTotals) -> dict[str, str]:
    values = {
        "subtotal": str(computed.subtotal),
        "discount": str(computed.discount),
        "taxable": str(computed.subtotal - computed.discount),
        "tax": str(computed.tax),
        "total": str(computed.total),
    }
    if computed.gst:
        values.update(
            taxable=str(computed.gst.taxable),
            cgst=str(computed.gst.cgst),
            sgst=str(computed.gst.sgst),
            igst=str(computed.gst.igst),
        )
    return values


def tax_rows(computed: ComputedTotals) -> tuple[tuple[str, str], ...]:
    """CGST + SGST (or UTGST) within a state, IGST between states, else one Tax line."""
    gst = computed.gst
    if gst is None:
        return render_service.DEFAULT_TAX_ROWS
    return (("cgst", "CGST"), ("sgst", gst.state_tax_label)) if gst.supply == "intra" else (("igst", "IGST"),)


def content(
    data: ReceiptDataIn, items: list[LineItemOut], computed: ComputedTotals,
    receipt_number: str, document_type: DocumentType,
) -> render_service.ReceiptContent:
    return render_service.ReceiptContent(
        values=receipt_service.variable_values(data, receipt_number, document_type),
        rows=[item_cells(item) for item in items],
        totals=totals_values(computed),
        tax_rows=tax_rows(computed),
    )


def content_from_stored(
    data: ReceiptDataOut, receipt_number: str, document_type: DocumentType = "receipt"
) -> render_service.ReceiptContent:
    return content(data, data.items, data.computed, receipt_number, document_type)


async def _receipt_pdf(db: AsyncSession, user: User, receipt: Receipt) -> bytes:
    relative = Path(str(user.id)) / f"{receipt.id}-v{RENDER_VERSION}.pdf"
    cached = settings.RECEIPT_STORAGE_DIR / relative
    if receipt.pdf_path == relative.as_posix() and cached.is_file():
        return cached.read_bytes()

    # Rendered from the snapshot taken at generation time, so later template
    # edits never change an issued receipt
    data = ReceiptDataOut.model_validate(receipt.data)
    assets = await render_service.asset_sources(db, user, receipt.template_snapshot)
    document_type: DocumentType = "gst_invoice" if receipt.document_type == "gst_invoice" else "receipt"
    html, _ = render_service.build_html(
        receipt.template_snapshot, content_from_stored(data, receipt.receipt_number, document_type), assets
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
    """Renders a canvas + data without saving anything or consuming a number.

    A GST invoice is previewed with its taxes, but the buyer-detail rules aren't
    enforced (a preview may be incomplete)."""
    document_type = canvas.documentType
    prepared = receipt_service.prepare(data, user, document_type, strict=False)
    _, next_number = await numbering_service.preview(
        db, user, document_type == "gst_invoice", prepared.data.receipt.date
    )
    number = prepared.data.receipt.number or next_number or ""
    page_content = content(prepared.data, prepared.items, prepared.computed, number, document_type)
    canvas_json = canvas.model_dump(mode="json")
    assets = await render_service.asset_sources(db, user, canvas_json)
    html, _ = render_service.build_html(canvas_json, page_content, assets)
    if fmt == "html":
        return ExportFile(html.encode("utf-8"), MEDIA_TYPES["html"], "preview.html")
    pdf = await render_service.render_pdf_async(html)
    body = pdf if fmt == "pdf" else await render_service.pdf_to_png_async(pdf)
    return ExportFile(body, MEDIA_TYPES[fmt], f"preview.{fmt}")
