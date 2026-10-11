import datetime as dt
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.api.rendering import (
    amount_too_large_error,
    file_response,
    overflow_error,
    qr_too_long_error,
    rate_limited_user,
    renderer_unavailable_error,
)
from app.core.db import get_db
from app.models.receipt import Receipt
from app.models.user import User
from app.schemas.canvas import DocumentType
from app.schemas.receipt import (
    NextNumberResponse,
    ReceiptCreate,
    ReceiptResponse,
    ReceiptSummary,
    ShareLink,
)
from app.services import (
    export_service,
    layout_service,
    numbering_service,
    qr_service,
    receipt_service,
    render_service,
    share_service,
    totals_service,
)

router = APIRouter()


def _error(status_code: int, code: str, message: str, fields: list[str]) -> HTTPException:
    # Structured detail so the Generate form can point at the offending fields
    return HTTPException(
        status_code=status_code, detail={"code": code, "message": message, "fields": fields}
    )


# Declared before /{receipt_id} so "next-number" isn't parsed as an id
@router.get("/next-number", response_model=NextNumberResponse)
async def next_number(
    document_type: Annotated[DocumentType, Query()] = "receipt",
    date: Annotated[dt.date | None, Query(description="GST invoices: the invoice date (default today)")] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NextNumberResponse:
    """Preview only: does not consume the sequence."""
    mode, number = await numbering_service.preview(db, current_user, document_type == "gst_invoice", date)
    return NextNumberResponse(mode=mode, next_number=number)


@router.post("", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
async def create_receipt(
    body: ReceiptCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Receipt:
    try:
        return await receipt_service.create_receipt(db, current_user, body)
    except receipt_service.TemplateNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found") from None
    except receipt_service.ReceiptRuleError as e:
        raise _error(status.HTTP_422_UNPROCESSABLE_CONTENT, e.code, e.message, e.fields) from None
    except numbering_service.InvoiceNumberInvalidError as e:
        raise _error(status.HTTP_422_UNPROCESSABLE_CONTENT, "INVOICE_NUMBER_INVALID", str(e), ["receipt.number"]) from None
    except receipt_service.MissingVariablesError as e:
        raise _error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "MISSING_VARIABLES",
            "Fill in every field the template uses.",
            e.missing,
        ) from None
    except totals_service.DiscountTooLargeError as e:
        raise _error(status.HTTP_422_UNPROCESSABLE_CONTENT, "DISCOUNT_TOO_LARGE", str(e), ["discount"]) from None
    except totals_service.AmountTooLargeError as e:
        raise amount_too_large_error(e) from None
    except qr_service.QrContentTooLongError as e:
        raise qr_too_long_error(e) from None
    except numbering_service.ReceiptNumberTakenError as e:
        raise _error(
            status.HTTP_409_CONFLICT,
            "RECEIPT_NUMBER_TAKEN",
            f"Receipt number {e.number} is already used. Choose another or leave it blank.",
            ["receipt.number"],
        ) from None
    except layout_service.ContentOverflowError as e:
        raise overflow_error(e.preset) from None


@router.get("", response_model=list[ReceiptSummary])
async def list_receipts(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[Receipt]:
    return await receipt_service.list_receipts(db, current_user)


@router.get("/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(
    receipt_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Receipt:
    receipt = await receipt_service.get_receipt(db, current_user, receipt_id)
    if receipt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    return receipt


@router.get(
    "/{receipt_id}/export",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}, "image/png": {}}}},
)
async def export_receipt(
    receipt_id: uuid.UUID,
    format: Literal["pdf", "png"] = Query("pdf"),
    current_user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """The receipt as a PDF (or PNG), rendered from its template snapshot."""
    receipt = await receipt_service.get_receipt(db, current_user, receipt_id)
    if receipt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    try:
        export = await export_service.export_receipt(db, current_user, receipt, format)
    except render_service.ContentOverflowError as e:
        raise overflow_error(e.preset) from None
    except qr_service.QrContentTooLongError as e:
        raise qr_too_long_error(e) from None
    except render_service.RendererUnavailableError:
        raise renderer_unavailable_error() from None
    return file_response(export)


@router.post("/{receipt_id}/share-link", response_model=ShareLink)
async def share_link(
    receipt_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShareLink:
    """A private link to the receipt's PDF that opens without signing in
    (GET /public/receipts/{token}), for sending to the customer."""
    receipt = await receipt_service.get_receipt(db, current_user, receipt_id)
    if receipt is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receipt not found")
    token = share_service.make_token(receipt.id)
    return ShareLink(token=token, path=f"/public/receipts/{token}")
