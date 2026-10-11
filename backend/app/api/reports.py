import datetime as dt
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.canvas import DocumentType
from app.schemas.report import ReportItem, ReportTotals, SalesReport
from app.services import report_service

router = APIRouter()

MAX_REPORT_DAYS = 3 * 366


@router.get("/sales", response_model=SalesReport)
async def sales_report(
    start: Annotated[dt.date, Query(description="First day, by receipt date")],
    end: Annotated[dt.date, Query(description="Last day, included")],
    currency: Annotated[str | None, Query(pattern=r"^[A-Za-z]{3}$")] = None,
    document_type: Annotated[DocumentType | None, Query()] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SalesReport:
    """Items sold between start and end, with quantities, amounts and totals."""
    if end < start:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The end date is before the start date.")
    if (end - start).days > MAX_REPORT_DAYS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Choose a period of at most 3 years.")
    report = await report_service.sales_report(db, current_user, start, end, currency, document_type)
    return SalesReport(
        start=start, end=end, document_type=document_type, currency=report.currency, currencies=report.currencies,
        receipt_count=report.receipt_count,
        items=[
            ReportItem(description=i.description, unit=i.unit, quantity=i.quantity, amount=i.amount, receipts=len(i.receipts))
            for i in report.items
        ],
        totals=ReportTotals(**report.totals),
    )
