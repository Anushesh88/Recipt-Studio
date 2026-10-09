import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from .canvas import Canvas


class TemplateCreate(BaseModel):
    name: str
    canvas: Canvas

class TemplateUpdate(BaseModel):
    name: str | None = None
    canvas: Canvas | None = None

class TemplateResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    canvas: Canvas
    schema_version: int
    thumbnail_path: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
