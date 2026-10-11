"""Pages anyone with the link can open, without signing in."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.rendering import export_limiter, file_response, renderer_unavailable_error
from app.core.db import get_db
from app.models.receipt import Receipt
from app.models.user import User
from app.services import export_service, render_service, share_service

router = APIRouter()

NOT_FOUND = "This receipt link isn't valid."


@router.get(
    "/receipts/{token}",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
async def shared_receipt(token: str, db: AsyncSession = Depends(get_db)) -> Response:
    """The PDF of the receipt a share link names (share_service)."""
    receipt_id = share_service.receipt_id_from(token)
    receipt = (await db.execute(select(Receipt).where(Receipt.id == receipt_id))).scalars().first() if receipt_id else None
    owner = await db.get(User, receipt.user_id) if receipt else None
    if receipt is None or owner is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    retry_after = export_limiter.hit(f"link:{receipt.id}")
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests for this receipt. Try again shortly.",
            headers={"Retry-After": str(retry_after)},
        )
    try:
        export = await export_service.export_receipt(db, owner, receipt, "pdf")
    except render_service.RendererUnavailableError:
        raise renderer_unavailable_error() from None
    response = file_response(export, download=False)
    # A private link: keep it out of search engines
    response.headers["X-Robots-Tag"] = "noindex"
    return response
