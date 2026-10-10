import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, StringConstraints

NumberingMode = Literal["sequential", "nanoid"]

# Letters, digits and a few separators, so numbers stay readable and file-name safe
ReceiptPrefix = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9 _\-/#.]{0,12}$")]
BusinessName = Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]


class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    business_name: str | None = None
    receipt_prefix: str
    numbering_mode: NumberingMode

    model_config = ConfigDict(from_attributes=True)


class AccountUpdate(BaseModel):
    """PATCH /auth/me: only the fields sent are changed."""
    # Pre-fills the {{business.name}} field of the Generate form; "" clears it
    business_name: BusinessName | None = None
    # Applies to numbers issued from now on; the sequence itself carries on
    receipt_prefix: ReceiptPrefix | None = None
    numbering_mode: NumberingMode | None = None
