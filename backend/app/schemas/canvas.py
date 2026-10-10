import uuid
from collections import Counter
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.services import gst_service, qr_service
from app.services.variables_service import unknown_variables

MAX_CANVAS_BYTES = 256 * 1024  # serialized template size limit (docs/03-schema.md)

# Limits below mirror frontend/src/lib/units.ts (the editor's own input ranges),
# so anything the editor can produce is accepted and anything else is rejected
# (Architecture backend rule 2)
MAX_ELEMENTS = 100
MIN_ELEMENT_SIZE = 8
ELEMENT_ID_MAX_LENGTH = 64
LABEL_MAX_LENGTH = 100  # table column headers, signature label
FONT_SIZE_MIN, FONT_SIZE_MAX = 6, 96
LINE_HEIGHT_MIN, LINE_HEIGHT_MAX = 0.8, 3
ROW_PADDING_MIN, ROW_PADDING_MAX = 0, 24
FONT_WEIGHTS = (400, 500, 600, 700)
CURRENCY_SYMBOL_MAX_LENGTH = 4
DIVIDER_THICKNESS_MIN = 1
MAX_PAGE_MARGIN = 96

# Page sizes come from the preset (docs/01-prd.md: thermal 80mm / A5 / A4).
# Thermal pages are auto-height with an editable design height.
MIN_DESIGN_HEIGHT, MAX_DESIGN_HEIGHT = 200, 3000
PresetName = Literal["thermal80", "a5", "a4"]
PAGE_PRESETS: dict[str, dict[str, float | str]] = {
    "thermal80": {"width": 302, "heightMode": "auto"},
    "a5": {"width": 559, "height": 794, "heightMode": "fixed"},
    "a4": {"width": 794, "height": 1123, "heightMode": "fixed"},
}

# The curated 8 fonts (docs/03-schema.md); mirrors FONT_FAMILIES in
# frontend/src/lib/units.ts. Phase 5 bundles the same files in app/fonts.
FontFamily = Literal[
    "Inter", "Roboto", "Open Sans", "Montserrat",
    "Lato", "Poppins", "Merriweather", "Roboto Mono",
]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$")]
Label = Annotated[str, StringConstraints(max_length=LABEL_MAX_LENGTH)]
FontSize = Annotated[float, Field(ge=FONT_SIZE_MIN, le=FONT_SIZE_MAX)]
LineHeight = Annotated[float, Field(ge=LINE_HEIGHT_MIN, le=LINE_HEIGHT_MAX)]


class CanvasModel(BaseModel):
    # Python's JSON parser accepts Infinity / NaN; no canvas number may be either
    model_config = ConfigDict(allow_inf_nan=False)


def validate_variables(text: str) -> None:
    """Text / QR content may only use built-in or custom.* variables."""
    unknown = unknown_variables(text)
    if unknown:
        raise ValueError(f"Unknown variable: {', '.join(unknown)}")

class BaseElement(CanvasModel):
    id: Annotated[str, StringConstraints(min_length=1, max_length=ELEMENT_ID_MAX_LENGTH)]
    x: float = Field(ge=0)
    y: float = Field(ge=0, le=MAX_DESIGN_HEIGHT)
    width: float = Field(ge=MIN_ELEMENT_SIZE)
    height: float = Field(ge=MIN_ELEMENT_SIZE, le=MAX_DESIGN_HEIGHT)
    zIndex: int = Field(default=1, ge=0, le=MAX_ELEMENTS)
    locked: bool = False

class TextProps(CanvasModel):
    content: str
    fontFamily: FontFamily
    fontSize: FontSize
    fontWeight: int = 400
    color: HexColor
    align: Literal["left", "center", "right", "justify"] = "left"
    lineHeight: LineHeight = 1.3

    @model_validator(mode="after")
    def check_content(self) -> "TextProps":
        validate_variables(self.content)
        if self.fontWeight not in FONT_WEIGHTS:
            raise ValueError(f"Font weight must be one of {', '.join(map(str, FONT_WEIGHTS))}.")
        return self

class TextElement(BaseElement):
    type: Literal["text"]
    props: TextProps

class ImageProps(CanvasModel):
    source: Literal["logo", "signature", "image"]
    assetId: uuid.UUID | None = None
    fit: Literal["contain", "cover", "fill"] = "contain"

class ImageElement(BaseElement):
    type: Literal["image"]
    props: ImageProps

# Line-item fields a table column can show (receipts.data items[]). The last
# five are for GST invoices; "qty" shows the unit too when there is one.
ItemColumnKey = Literal[
    "description", "qty", "unit_price", "line_total",
    "hsn", "discount", "taxable_value", "gst_rate", "tax_amount",
]
MAX_COLUMNS = 9


class ColumnDef(CanvasModel):
    key: ItemColumnKey
    label: Label
    width: float = Field(ge=0, le=1)  # fraction of the table width
    align: Literal["left", "center", "right"]

class ItemsTableProps(CanvasModel):
    binding: Literal["receipt.items"]
    columns: list[ColumnDef] = Field(min_length=1, max_length=MAX_COLUMNS)
    fontFamily: FontFamily
    fontSize: FontSize
    lineHeight: LineHeight = 1.3
    rowPadding: float = Field(default=4, ge=ROW_PADDING_MIN, le=ROW_PADDING_MAX)
    headerBold: bool = True
    rowDivider: bool = True
    color: HexColor

    @model_validator(mode="after")
    def check_columns(self) -> "ItemsTableProps":
        if len({c.key for c in self.columns}) != len(self.columns):
            raise ValueError("Each line-item field can only have one column.")
        return self

class ItemsTableElement(BaseElement):
    type: Literal["items_table"]
    props: ItemsTableProps

# "taxable" = subtotal - discount. On a GST invoice "tax" prints as CGST + SGST
# (or UTGST) within a state, or IGST between states.
TotalsLine = Literal["subtotal", "discount", "taxable", "tax", "total"]


class TotalsProps(CanvasModel):
    binding: Literal["receipt.totals"]
    show: list[TotalsLine] = Field(max_length=5)
    fontFamily: FontFamily
    fontSize: FontSize
    emphasizeTotal: bool = True
    currencySymbol: Annotated[str, StringConstraints(max_length=CURRENCY_SYMBOL_MAX_LENGTH)] = "$"

    @model_validator(mode="after")
    def check_show(self) -> "TotalsProps":
        if len(set(self.show)) != len(self.show):
            raise ValueError("Each totals line can only be shown once.")
        return self

class TotalsElement(BaseElement):
    type: Literal["totals"]
    props: TotalsProps

class QrProps(CanvasModel):
    content: str
    errorCorrection: qr_service.ErrorCorrection = "M"

    @model_validator(mode="after")
    def check_content(self) -> "QrProps":
        validate_variables(self.content)
        if not qr_service.fits(self.content, self.errorCorrection):
            raise ValueError(qr_service.too_long_message(self.errorCorrection))
        return self

class QrElement(BaseElement):
    type: Literal["qr"]
    props: QrProps

class SignatureProps(CanvasModel):
    label: Label
    assetId: uuid.UUID | None = None
    lineColor: HexColor

class SignatureElement(BaseElement):
    type: Literal["signature"]
    props: SignatureProps

class DividerProps(CanvasModel):
    style: Literal["solid", "dashed", "dotted"]
    # The divider's box is a MIN_ELEMENT_SIZE strip; the line sits inside it
    thickness: float = Field(ge=DIVIDER_THICKNESS_MIN, le=MIN_ELEMENT_SIZE)
    color: HexColor

class DividerElement(BaseElement):
    type: Literal["divider"]
    props: DividerProps

CanvasElement = Annotated[
    TextElement | ImageElement | ItemsTableElement | TotalsElement | QrElement | SignatureElement | DividerElement,
    Field(discriminator="type")
]

class PageConfig(CanvasModel):
    preset: PresetName
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    heightMode: Literal["auto", "fixed"]
    background: HexColor
    margin: float = Field(ge=0, le=MAX_PAGE_MARGIN)

    @model_validator(mode="after")
    def check_preset_size(self) -> "PageConfig":
        preset = PAGE_PRESETS[self.preset]
        if self.width != preset["width"] or self.heightMode != preset["heightMode"]:
            raise ValueError(
                f"A {self.preset} page is {preset['width']}px wide with {preset['heightMode']} height."
            )
        if self.heightMode == "fixed" and self.height != preset["height"]:
            raise ValueError(f"A {self.preset} page is {preset['height']}px tall.")
        if self.heightMode == "auto" and not MIN_DESIGN_HEIGHT <= self.height <= MAX_DESIGN_HEIGHT:
            raise ValueError(
                f"The design height must be between {MIN_DESIGN_HEIGHT} and {MAX_DESIGN_HEIGHT}px."
            )
        return self

DocumentType = Literal["receipt", "gst_invoice"]


class Canvas(CanvasModel):
    schemaVersion: Literal[1] = 1
    # A plain receipt, or a GST tax invoice that must show rule 46's particulars
    documentType: DocumentType = "receipt"
    page: PageConfig
    elements: list[CanvasElement] = Field(max_length=MAX_ELEMENTS)

    @model_validator(mode="after")
    def validate_canvas(self) -> "Canvas":
        items_table_count = sum(1 for e in self.elements if e.type == "items_table")
        totals_count = sum(1 for e in self.elements if e.type == "totals")
        if items_table_count > 1:
            raise ValueError("Max one items_table element is allowed.")
        if totals_count > 1:
            raise ValueError("Max one totals element is allowed.")

        id_counts = Counter(e.id for e in self.elements)
        duplicates = sorted(i for i, n in id_counts.items() if n > 1)
        if duplicates:
            raise ValueError(f"Duplicate element ids: {', '.join(duplicates)}")

        # Elements must fit the page width; fixed-height pages also bound the height
        # (auto-height pages grow at generation time).
        for e in self.elements:
            if e.x + e.width > self.page.width:
                raise ValueError(f"Element {e.id} extends past the page width.")
            if self.page.heightMode == "fixed" and e.y + e.height > self.page.height:
                raise ValueError(f"Element {e.id} extends past the page height.")

        if self.documentType == "gst_invoice":
            missing = gst_service.missing_particulars(e.model_dump() for e in self.elements)
            if missing:
                raise ValueError(f"A GST tax invoice must show: {'; '.join(missing)}.")

        if len(self.model_dump_json().encode()) > MAX_CANVAS_BYTES:
            raise ValueError(f"Template is larger than {MAX_CANVAS_BYTES // 1024} KB.")
        return self
