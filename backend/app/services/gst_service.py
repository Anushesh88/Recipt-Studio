"""GST tax invoices (CGST Rules 2017, rule 46) for regular taxpayers with an
aggregate turnover up to Rs 5 crore, so no e-invoice IRN is needed.

Mirrored by frontend/src/lib/gst.ts; both are checked against
shared/fixtures/gst_cases.json. Not legal advice: the rules here are the
commonly applied reading of rule 46 and notification 78/2020 (HSN digits).

- GSTIN: 15 characters, state code + PAN + entity + "Z" + a mod-36 check
  character; its first two digits are the holder's state code.
- Supply within one state (supplier state == place of supply): CGST + SGST,
  half the rate each (UTGST instead of SGST in Union territories without a
  legislature). Between states: IGST at the full rate.
- Per line: taxable value = round(qty * unit price) - line discount; each tax
  is rounded half-up to the paisa per line, then summed.
- Invoice numbers: at most 16 characters of letters, digits, "-" and "/",
  consecutive and unique within a financial year (April to March).
- Unregistered buyer with a taxable value of Rs 50,000 or more: name, address
  (used as the delivery address) and state are required. A registered buyer
  needs name, address and GSTIN. HSN codes (4, 6 or 8 digits) are required on
  every line of a B2B invoice; for B2C they may be left out.
"""
import datetime as dt
import re
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Literal

from app.services import variables_service

CENT = Decimal("0.01")
ZERO = Decimal("0.00")
HUNDRED = Decimal(100)

# GST state / UT codes (the first two digits of a GSTIN)
STATES: dict[str, str] = {
    "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
    "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
    "97": "Other Territory",
}
# Union territories without a legislature charge UTGST in place of SGST
UTGST_STATES = frozenset({"04", "26", "31", "35", "38"})

GSTIN_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
_GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
HSN_PATTERN = re.compile(r"^(\d{4}|\d{6}|\d{8})$")
INVOICE_NUMBER_PATTERN = re.compile(r"^[A-Za-z0-9/-]{1,16}$")
INVOICE_NUMBER_MAX_LENGTH = 16
INVOICE_PREFIX_PATTERN = re.compile(r"^[A-Za-z0-9/-]{0,6}$")
MAX_GST_RATE = Decimal(40)
# Rule 46(e): an unregistered buyer's details are required from this taxable value
UNREGISTERED_DETAILS_THRESHOLD = Decimal(50000)
UNREGISTERED = "Unregistered"

Supply = Literal["intra", "inter"]


def gstin_check_char(first14: str) -> str:
    total = 0
    for i, char in enumerate(first14):
        value = _GSTIN_CHARS.index(char) * (2 if i % 2 else 1)
        total += value // 36 + value % 36
    return _GSTIN_CHARS[(36 - total % 36) % 36]


def gstin_problem(gstin: str) -> str | None:
    """Why this isn't a valid GSTIN, or None."""
    if not GSTIN_PATTERN.match(gstin):
        return "A GSTIN is 15 characters, like 27AAPFU0939F1ZV."
    if gstin[:2] not in STATES:
        return f"{gstin[:2]} isn't a GST state code."
    if gstin_check_char(gstin[:14]) != gstin[14]:
        return "This GSTIN's last character doesn't match; check it for a typo."
    return None


def state_label(code: str) -> str:
    """'Karnataka (29)'"""
    return f"{STATES[code]} ({code})" if code in STATES else ""


def state_tax_label(supplier_state: str) -> str:
    return "UTGST" if supplier_state in UTGST_STATES else "SGST"


def supply_type(supplier_state: str, place_of_supply: str) -> Supply:
    return "intra" if supplier_state == place_of_supply else "inter"


def financial_year(day: dt.date) -> int:
    """The calendar year the Indian financial year (April to March) starts in."""
    return day.year if day.month >= 4 else day.year - 1


def financial_year_label(start_year: int) -> str:
    """2026 -> '26-27'"""
    return f"{start_year % 100:02d}-{(start_year + 1) % 100:02d}"


def format_invoice_number(prefix: str, start_year: int, seq: int) -> str:
    """'INV/' + '26-27' + '/0001'"""
    return f"{prefix}{financial_year_label(start_year)}/{seq:04d}"


def to_cents(amount: Decimal) -> Decimal:
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def format_rate(rate: Decimal) -> str:
    """Decimal('18') -> '18%', Decimal('2.50') -> '2.5%'"""
    text = format(rate.normalize(), "f")
    return f"{text}%"


@dataclass(frozen=True)
class GstLineInput:
    qty: Decimal
    unit_price: Decimal
    discount: Decimal
    gst_rate: Decimal  # percent, e.g. 18


@dataclass(frozen=True)
class GstLine:
    amount: Decimal         # round(qty * unit price)
    taxable_value: Decimal  # amount - discount
    cgst: Decimal
    sgst: Decimal
    igst: Decimal

    @property
    def tax(self) -> Decimal:
        return self.cgst + self.sgst + self.igst


@dataclass(frozen=True)
class GstTotals:
    supply: Supply
    state_tax_label: str    # "SGST" or "UTGST"
    lines: list[GstLine]
    subtotal: Decimal       # sum of line amounts
    discount: Decimal       # sum of line discounts
    taxable: Decimal
    cgst: Decimal
    sgst: Decimal
    igst: Decimal
    total: Decimal

    @property
    def tax(self) -> Decimal:
        return self.cgst + self.sgst + self.igst


class LineDiscountTooLargeError(ValueError):
    def __init__(self, index: int) -> None:
        super().__init__("An item's discount can't be more than its amount.")
        self.index = index


def _sum(amounts: Iterable[Decimal]) -> Decimal:
    return sum(amounts, ZERO)


def compute_totals(lines: Sequence[GstLineInput], supplier_state: str, place_of_supply: str) -> GstTotals:
    supply = supply_type(supplier_state, place_of_supply)
    computed: list[GstLine] = []
    for index, line in enumerate(lines):
        amount = to_cents(line.qty * line.unit_price)
        discount = to_cents(line.discount)
        if discount > amount:
            raise LineDiscountTooLargeError(index)
        taxable = amount - discount
        if supply == "intra":
            half = to_cents(taxable * line.gst_rate / 2 / HUNDRED)
            computed.append(GstLine(amount, taxable, half, half, ZERO))
        else:
            computed.append(GstLine(amount, taxable, ZERO, ZERO, to_cents(taxable * line.gst_rate / HUNDRED)))
    taxable = _sum(c.taxable_value for c in computed)
    cgst, sgst, igst = _sum(c.cgst for c in computed), _sum(c.sgst for c in computed), _sum(c.igst for c in computed)
    return GstTotals(
        supply=supply,
        state_tax_label=state_tax_label(supplier_state),
        lines=computed,
        subtotal=_sum(c.amount for c in computed),
        discount=_sum(c.amount - c.taxable_value for c in computed),
        taxable=taxable,
        cgst=cgst,
        sgst=sgst,
        igst=igst,
        total=taxable + cgst + sgst + igst,
    )


# --- Templates: what a GST invoice template must show (rule 46) ------------------

# Variables a GST invoice must print, with what they are
REQUIRED_VARIABLES: dict[str, str] = {
    "business.name": "Your business name",
    "business.address": "Your business address",
    "business.gstin": "Your GSTIN",
    "receipt.number": "Invoice number",
    "receipt.date": "Invoice date",
    "customer.name": "Customer name",
    "customer.address": "Customer address",
    "customer.gstin": "Customer GSTIN",
    "receipt.place_of_supply": "Place of supply (state)",
    "receipt.reverse_charge": "Reverse charge (Yes / No)",
}
REQUIRED_COLUMNS: dict[str, str] = {
    "description": "Item description column",
    "hsn": "HSN / SAC column",
    "qty": "Quantity (with unit) column",
    "gst_rate": "GST rate column",
    "taxable_value": "Taxable value column",
}
REQUIRED_TOTALS: dict[str, str] = {
    "taxable": "Taxable value total",
    "tax": "Tax lines (CGST + SGST, or IGST)",
    "total": "Invoice total",
}
SIGNATURE_REQUIREMENT = "Signature"


def missing_particulars(elements: Iterable[Mapping[str, Any]]) -> list[str]:
    """What a GST invoice template still lacks, as readable names (empty = compliant)."""
    elements = list(elements)
    # Printed text only: a QR code doesn't show anything to the reader
    used = set(variables_service.extract_variables(e for e in elements if e.get("type") == "text"))
    missing = [label for key, label in REQUIRED_VARIABLES.items() if key not in used]

    table = next((e for e in elements if e.get("type") == "items_table"), None)
    columns = {c.get("key") for c in table.get("props", {}).get("columns", [])} if table else set()
    missing += [label for key, label in REQUIRED_COLUMNS.items() if key not in columns]

    totals = next((e for e in elements if e.get("type") == "totals"), None)
    shown = set(totals.get("props", {}).get("show", [])) if totals else set()
    missing += [label for key, label in REQUIRED_TOTALS.items() if key not in shown]

    if not any(e.get("type") == "signature" for e in elements):
        missing.append(SIGNATURE_REQUIREMENT)
    return missing
