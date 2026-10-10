import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.core.db import get_db
from app.models.catalog import CatalogItem, Customer
from app.models.user import User
from app.schemas.catalog import CatalogItemResponse, CustomerResponse
from app.services import catalog_service

router = APIRouter()


@router.get("/customers", response_model=list[CustomerResponse])
async def list_customers(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[Customer]:
    """Customers from past receipts, most recent first."""
    return await catalog_service.list_customers(db, current_user)


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def forget_customer(
    customer_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if not await catalog_service.forget_customer(db, current_user, customer_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/items", response_model=list[CatalogItemResponse])
async def list_items(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[CatalogItem]:
    """Items from past receipts (with HSN, unit, price and GST rate), most recent first."""
    return await catalog_service.list_items(db, current_user)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def forget_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if not await catalog_service.forget_item(db, current_user, item_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
