import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

AssetKind = Literal["logo", "signature", "image"]


class AssetResponse(BaseModel):
    id: uuid.UUID
    kind: AssetKind
    mime_type: str
    size_bytes: int
    created_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
