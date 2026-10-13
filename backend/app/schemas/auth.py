import uuid
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    StringConstraints,
)

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
Phone = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^$|^\+?[0-9][0-9 \-]{5,19}$")]
# name@bank, as UPI apps show it
UpiId = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^$|^[A-Za-z0-9.\-_]{2,256}@[A-Za-z]{2,64}$")]
Pan = Annotated[
    str,
    BeforeValidator(lambda v: v.strip().upper() if isinstance(v, str) else v),
    StringConstraints(pattern=r"^$|^[A-Z]{5}[0-9]{4}[A-Z]$"),
]
ProfileText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]
# Font pairings a brand kit can pick (frontend lib/brand.ts BRAND_FONT_PAIRS)
BrandFonts = Literal["inter", "poppins-inter", "montserrat-open-sans", "merriweather-lato", "roboto"]
# GST invoice numbers are prefix + "26-27/0001" and may be at most 16 characters
InvoicePrefix = Annotated[str, StringConstraints(pattern=gst_service.INVOICE_PREFIX_PATTERN.pattern)]


class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

class GoogleCredential(BaseModel):
    """POST /auth/google: the ID token Google Identity Services gave the browser."""
    credential: Annotated[str, StringConstraints(min_length=1, max_length=4096)]


class ForgotPassword(BaseModel):
    """POST /auth/forgot-password"""
    email: Email


class ResetPassword(BaseModel):
    """POST /auth/reset-password: the token from the emailed link."""
    token: Annotated[str, StringConstraints(min_length=1, max_length=2048)]
    password: Password


class AuthProviders(BaseModel):
    """GET /auth/providers: which sign-in options the login page offers."""
    google_client_id: str | None


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
    business_phone: str | None = None
    business_email: str | None = None
    upi_id: str | None = None
    pan: str | None = None
    bank_details: str | None = None
    licence: str | None = None
    brand_logo_asset_id: uuid.UUID | None = None
    brand_color: str | None = None
    brand_fonts: BrandFonts | None = None
    # How the account signs in
    has_password: bool
    google_linked: bool
    is_admin: bool  # can read feedback (ADMIN_EMAILS)

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
    # Business profile and brand kit; "" (or null for the logo) clears them
    business_phone: Phone | None = None
    business_email: EmailStr | Literal[""] | None = None
    upi_id: UpiId | None = None
    pan: Pan | None = None
    bank_details: ProfileText | None = None
    licence: ProfileText | None = None
    brand_logo_asset_id: uuid.UUID | None = None
    brand_color: HexColor | Literal[""] | None = None
    brand_fonts: BrandFonts | Literal[""] | None = None
