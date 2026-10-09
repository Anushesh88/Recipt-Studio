import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.core.db import get_db
from app.models.template import Template
from app.models.user import User
from app.schemas.template import (
    TemplateCreate,
    TemplateResponse,
    TemplateSummary,
    TemplateUpdate,
)
from app.services import template_service

router = APIRouter()


async def _owned_template(db: AsyncSession, user: User, template_id: uuid.UUID) -> Template:
    template = await template_service.get_template(db, user, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.get("", response_model=list[TemplateSummary])
async def list_templates(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[TemplateSummary]:
    templates = await template_service.list_templates(db, current_user)
    return [template_service.summarize(t) for t in templates]


@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    body: TemplateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Template:
    return await template_service.create_template(db, current_user, body.name, body.canvas)


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Template:
    return await _owned_template(db, current_user, template_id)


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: uuid.UUID,
    body: TemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Template:
    template = await _owned_template(db, current_user, template_id)
    return await template_service.update_template(db, template, body.name, body.canvas)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_template(
    template_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    template = await _owned_template(db, current_user, template_id)
    await template_service.delete_template(db, template)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
