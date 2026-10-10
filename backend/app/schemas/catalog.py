import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class CustomerResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None
    gstin: str | None
    address: str | None
    state_code: str | None

    model_config = ConfigDict(from_attributes=True)


class CatalogItemResponse(BaseModel):
    id: uuid.UUID
    description: str
    hsn: str | None
    unit: str | None
    unit_price: Decimal
    gst_rate: Decimal | None

    model_config = ConfigDict(from_attributes=True)
