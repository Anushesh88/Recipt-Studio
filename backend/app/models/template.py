import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.types import JSON

from .base import Base

# Support SQLite JSON fallback for local dev
JsonType = JSON().with_variant(JSONB, 'postgresql')

class Template(Base):
    __tablename__ = "templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    canvas = Column(JsonType, nullable=False)
    schema_version = Column(Integer, nullable=False, default=1)
    thumbnail_path = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_templates_user_id_updated_at", "user_id", "updated_at"),
    )
