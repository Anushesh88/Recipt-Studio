import re
from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

VARIABLE_REGEX = re.compile(r"\{\{\s*([a-z_]+(?:\.[a-z_]+)?)\s*\}\}")

BUILTIN_VARIABLES = {
    "business.name", "customer.name", "customer.email", "receipt.number",
    "receipt.date", "receipt.payment_method", "receipt.currency", "receipt.notes"
}

def validate_variables(text: str) -> None:
    matches = VARIABLE_REGEX.findall(text)
    for match in matches:
        if match not in BUILTIN_VARIABLES and not match.startswith("custom."):
            raise ValueError(f"Unknown variable: {match}")

class BaseElement(BaseModel):
    id: str
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    width: float = Field(ge=8)
    height: float = Field(ge=8)
    zIndex: int = 1
    locked: bool = False

class TextProps(BaseModel):
    content: str
    fontFamily: str
    fontSize: float = Field(ge=6, le=96)
    fontWeight: int = 400
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    align: Literal["left", "center", "right", "justify"] = "left"
    lineHeight: float = 1.3

    @model_validator(mode="after")
    def check_variables(self) -> "TextProps":
        validate_variables(self.content)
        return self

class TextElement(BaseElement):
    type: Literal["text"]
    props: TextProps

class ImageProps(BaseModel):
    source: Literal["logo", "signature", "image"]
    assetId: str | None = None
    fit: Literal["contain", "cover", "fill"] = "contain"

class ImageElement(BaseElement):
    type: Literal["image"]
    props: ImageProps

class ColumnDef(BaseModel):
    key: str
    label: str
    width: float
    align: Literal["left", "center", "right"]

class ItemsTableProps(BaseModel):
    binding: Literal["receipt.items"]
    columns: list[ColumnDef]
    fontFamily: str
    fontSize: float = Field(ge=6, le=96)
    lineHeight: float = 1.3
    rowPadding: float = 4
    headerBold: bool = True
    rowDivider: bool = True
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")

class ItemsTableElement(BaseElement):
    type: Literal["items_table"]
    props: ItemsTableProps

class TotalsProps(BaseModel):
    binding: Literal["receipt.totals"]
    show: list[Literal["subtotal", "tax", "discount", "total"]]
    fontFamily: str
    fontSize: float = Field(ge=6, le=96)
    emphasizeTotal: bool = True
    currencySymbol: str = "$"

class TotalsElement(BaseElement):
    type: Literal["totals"]
    props: TotalsProps

class QrProps(BaseModel):
    content: str
    errorCorrection: Literal["L", "M", "Q", "H"] = "M"

    @model_validator(mode="after")
    def check_variables(self) -> "QrProps":
        validate_variables(self.content)
        return self

class QrElement(BaseElement):
    type: Literal["qr"]
    props: QrProps

class SignatureProps(BaseModel):
    label: str
    assetId: str | None = None
    lineColor: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")

class SignatureElement(BaseElement):
    type: Literal["signature"]
    props: SignatureProps

class DividerProps(BaseModel):
    style: Literal["solid", "dashed", "dotted"]
    thickness: float = Field(ge=1)
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")

class DividerElement(BaseElement):
    type: Literal["divider"]
    props: DividerProps

CanvasElement = Annotated[
    TextElement | ImageElement | ItemsTableElement | TotalsElement | QrElement | SignatureElement | DividerElement,
    Field(discriminator="type")
]

class PageConfig(BaseModel):
    preset: Literal["thermal80", "a5", "a4"]
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    heightMode: Literal["auto", "fixed"]
    background: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    margin: float = Field(ge=0)

class Canvas(BaseModel):
    schemaVersion: Literal[1] = 1
    page: PageConfig
    elements: list[CanvasElement] = Field(max_length=100)

    @model_validator(mode="after")
    def validate_canvas(self) -> "Canvas":
        items_table_count = sum(1 for e in self.elements if e.type == "items_table")
        totals_count = sum(1 for e in self.elements if e.type == "totals")
        if items_table_count > 1:
            raise ValueError("Max one items_table element is allowed.")
        if totals_count > 1:
            raise ValueError("Max one totals element is allowed.")
        return self
