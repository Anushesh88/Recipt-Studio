from datetime import datetime

from pydantic import BaseModel

from .canvas import Canvas


class TemplateCreate(BaseModel):
    name: str
    canvas: Canvas

class TemplateUpdate(BaseModel):
    name: str | None = None
    canvas: Canvas | None = None

class TemplateResponse(BaseModel):
    id: str
    user_id: str
    name: str
    canvas: Canvas
    schema_version: int
    thumbnail_path: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
