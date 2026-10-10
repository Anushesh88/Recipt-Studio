import uuid
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, StringConstraints

from app.services import gst_service

from .common import Gstin

PASSWORD_MIN_LENGTH = 8
# bcrypt only looks at the first 72 bytes; longer passwords are refused rather
# than silently cut short
PASSWORD_MAX_BYTES = 72


def _check_password_bytes(password: str) -> str:
    if len(password.encode("utf-8")) > PASSWORD_MAX_BYTES:
        raise ValueError(f"Password must be at most {PASSWORD_MAX_BYTES} bytes long")
    return password


Password = Annotated[
    str, StringConstraints(min_length=PASSWORD_MIN_LENGTH), AfterValidator(_check_password_bytes)
]
# Stored lowercase: one account per address, however it's typed
Email = Annotated[EmailStr, AfterValidator(str.lower)]

NumberingMode = Literal["sequential", "nanoid"]
InvoicingMode = Literal["receipts", "gst", "both"]

# Letters, digits and a few separators, so numbers stay readable and file-name safe
ReceiptPrefix = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9 _\-/#.]{0,12}$")]
BusinessName = Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]
BusinessAddress = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
# GST invoice numbers are prefix + "26-27/0001" and may be at most 16 characters
InvoicePrefix = Annotated[str, StringConstraints(pattern=gst_service.INVOICE_PREFIX_PATTERN.pattern)]


class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

class UserCreate(BaseModel):
    email: Email
    password: Password

class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    business_name: str | None = None
    receipt_prefix: str
    numbering_mode: NumberingMode
    business_address: str | None = None
    gstin: str | None = None
    invoice_prefix: str
    invoicing_mode: InvoicingMode | None = None  # None until the welcome question is answered

    model_config = ConfigDict(from_attributes=True)


class AccountUpdate(BaseModel):
    """PATCH /auth/me: only the fields sent are changed."""
    # Pre-fills the {{business.name}} field of the Generate form; "" clears it
    business_name: BusinessName | None = None
    # Applies to numbers issued from now on; the sequence itself carries on
    receipt_prefix: ReceiptPrefix | None = None
    numbering_mode: NumberingMode | None = None
    # GST tax invoices: printed as the supplier's address and GSTIN; "" clears them
    business_address: BusinessAddress | None = None
    gstin: Gstin | Literal[""] | None = None
    invoice_prefix: InvoicePrefix | None = None
    invoicing_mode: InvoicingMode | None = None
