from typing import Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.rendering import (
    api_error,
    file_response,
    overflow_error,
    rate_limited_user,
    renderer_unavailable_error,
)
from app.core.db import get_db
from app.models.user import User
from app.schemas.canvas import Canvas
from app.schemas.receipt import ReceiptDataIn
from app.services import export_service, render_service, totals_service

router = APIRouter()


class PreviewRequest(BaseModel):
    canvas: Canvas
    data: ReceiptDataIn
    # "html" returns the exact page the PDF is made from (debugging / parity tests)
    format: Literal["pdf", "png", "html"] = "pdf"


@router.post(
    "",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}, "image/png": {}, "text/html": {}}}},
)
async def preview(
    body: PreviewRequest,
    current_user: User = Depends(rate_limited_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Renders a canvas with data without saving a receipt or using a number."""
    try:
        export = await export_service.preview(db, current_user, body.canvas, body.data, body.format)
    except totals_service.DiscountTooLargeError as e:
        raise api_error(status.HTTP_422_UNPROCESSABLE_CONTENT, "DISCOUNT_TOO_LARGE", str(e), ["discount"]) from None
    except render_service.ContentOverflowError as e:
        raise overflow_error(e.preset) from None
    except render_service.RendererUnavailableError:
        raise renderer_unavailable_error() from None
    return file_response(export, download=False)
