"""Customers and items remembered from past receipts, for autofill.

Every receipt updates the list: the customer by name and each item by
description (case-insensitive). New details replace old ones; details a new
receipt leaves out (an item's HSN on a plain receipt, say) are kept.
"""
import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.catalog import CatalogItem, Customer
from app.models.user import User
from app.schemas.receipt import ReceiptDataIn
from app.services.numbering_service import upsert

LIST_LIMIT = 500


async def remember(db: AsyncSession, user: User, data: ReceiptDataIn) -> None:
    """Saves the receipt's customer and items (inside the caller's transaction)."""
    name = (data.customer.name or "").strip()
    if name:
        gstin = data.customer.gstin
        state = gstin[:2] if gstin else data.receipt.place_of_supply
        insert = upsert(db, Customer).values(
            user_id=user.id, name=name, name_key=name.lower(), email=data.customer.email,
            gstin=gstin, address=data.customer.address, state_code=state,
        )
        await db.execute(insert.on_conflict_do_update(
            index_elements=[Customer.user_id, Customer.name_key],
            set_={
                "name": insert.excluded.name,
                "email": func.coalesce(insert.excluded.email, Customer.email),
                "gstin": func.coalesce(insert.excluded.gstin, Customer.gstin),
                "address": func.coalesce(insert.excluded.address, Customer.address),
                "state_code": func.coalesce(insert.excluded.state_code, Customer.state_code),
                "updated_at": func.now(),
            },
        ))

    for item in data.items:
        insert = upsert(db, CatalogItem).values(
            user_id=user.id, description=item.description, description_key=item.description.lower(),
            hsn=item.hsn, unit=item.unit, unit_price=item.unit_price, gst_rate=item.gst_rate,
        )
        await db.execute(insert.on_conflict_do_update(
            index_elements=[CatalogItem.user_id, CatalogItem.description_key],
            set_={
                "description": insert.excluded.description,
                "unit_price": insert.excluded.unit_price,
                "hsn": func.coalesce(insert.excluded.hsn, CatalogItem.hsn),
                "unit": func.coalesce(insert.excluded.unit, CatalogItem.unit),
                "gst_rate": func.coalesce(insert.excluded.gst_rate, CatalogItem.gst_rate),
                "updated_at": func.now(),
            },
        ))


async def list_customers(db: AsyncSession, user: User) -> list[Customer]:
    result = await db.execute(
        select(Customer).where(Customer.user_id == user.id)
        .order_by(Customer.updated_at.desc()).limit(LIST_LIMIT)
    )
    return list(result.scalars().all())


async def list_items(db: AsyncSession, user: User) -> list[CatalogItem]:
    result = await db.execute(
        select(CatalogItem).where(CatalogItem.user_id == user.id)
        .order_by(CatalogItem.updated_at.desc()).limit(LIST_LIMIT)
    )
    return list(result.scalars().all())


async def forget_customer(db: AsyncSession, user: User, customer_id: uuid.UUID) -> bool:
    result = await db.execute(delete(Customer).where(Customer.id == customer_id, Customer.user_id == user.id))
    await db.commit()
    return bool(result.rowcount)  # type: ignore[attr-defined]


async def forget_item(db: AsyncSession, user: User, item_id: uuid.UUID) -> bool:
    result = await db.execute(delete(CatalogItem).where(CatalogItem.id == item_id, CatalogItem.user_id == user.id))
    await db.commit()
    return bool(result.rowcount)  # type: ignore[attr-defined]
