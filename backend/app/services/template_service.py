"""Templates CRUD, always scoped to the owning user (Architecture rule 4)."""
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.template import Template
from app.models.user import User
from app.schemas.canvas import Canvas
from app.schemas.template import TemplateSummary


def _canvas_json(canvas: Canvas) -> dict[str, object]:
    return canvas.model_dump(mode="json")


def summarize(template: Template) -> TemplateSummary:
    return TemplateSummary(
        id=template.id,
        name=template.name,
        preset=str(template.canvas.get("page", {}).get("preset", "")),
        element_count=len(template.canvas.get("elements", [])),
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


async def list_templates(db: AsyncSession, user: User) -> list[Template]:
    result = await db.execute(
        select(Template)
        .where(Template.user_id == user.id)
        .order_by(Template.updated_at.desc(), Template.created_at.desc())
    )
    return list(result.scalars().all())


async def get_template(db: AsyncSession, user: User, template_id: uuid.UUID) -> Template | None:
    result = await db.execute(
        select(Template).where(Template.id == template_id, Template.user_id == user.id)
    )
    return result.scalars().first()


async def create_template(db: AsyncSession, user: User, name: str, canvas: Canvas) -> Template:
    template = Template(
        user_id=user.id,
        name=name,
        canvas=_canvas_json(canvas),
        schema_version=canvas.schemaVersion,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def update_template(
    db: AsyncSession, template: Template, name: str | None, canvas: Canvas | None
) -> Template:
    if name is not None:
        template.name = name
    if canvas is not None:
        template.canvas = _canvas_json(canvas)
        template.schema_version = canvas.schemaVersion
    await db.commit()
    await db.refresh(template)
    return template


async def delete_template(db: AsyncSession, template: Template) -> None:
    await db.delete(template)
    await db.commit()
