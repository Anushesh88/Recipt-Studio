import uuid
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

from .canvas import Canvas, DocumentType
from .common import UtcDatetime

TemplateName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class TemplateCreate(BaseModel):
    name: TemplateName
    canvas: Canvas


class TemplateUpdate(BaseModel):
    name: TemplateName | None = None
    canvas: Canvas | None = None


class TemplateSummary(BaseModel):
    """List entry for the Templates page (no canvas payload)."""
    id: uuid.UUID
    name: str
    preset: str
    document_type: DocumentType
    element_count: int
    created_at: UtcDatetime | None
    updated_at: UtcDatetime | None


class TemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    canvas: Canvas
    schema_version: int
    thumbnail_path: str | None
    created_at: UtcDatetime | None
    updated_at: UtcDatetime | None

    model_config = ConfigDict(from_attributes=True)
