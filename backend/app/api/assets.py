import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.core.config import settings
from app.core.db import get_db
from app.models.asset import Asset
from app.models.user import User
from app.schemas.asset import AssetKind, AssetResponse
from app.services import asset_service

router = APIRouter()


@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    file: Annotated[UploadFile, File()],
    kind: Annotated[AssetKind, Form()],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Asset:
    try:
        return await asset_service.save_asset(db, current_user, kind, file)
    except asset_service.AssetTooLargeError:
        limit_mb = settings.MAX_ASSET_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Image is larger than {limit_mb} MB.",
        ) from None
    except asset_service.UnsupportedAssetTypeError:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PNG and JPG images are supported.",
        ) from None


# Binary response: the file itself, so there is no Pydantic response model
@router.get("/{asset_id}", response_class=FileResponse)
async def get_asset_file(
    asset_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    asset = await asset_service.get_user_asset(db, current_user, asset_id)
    path = asset_service.asset_file_path(asset) if asset else None
    if asset is None or path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return FileResponse(
        path,
        media_type=asset.mime_type,
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"},
    )
