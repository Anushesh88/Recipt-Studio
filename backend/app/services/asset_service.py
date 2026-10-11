"""Logo / signature uploads (Architecture rule 6).

The content type is decided from the file's magic bytes, never from the
client-supplied Content-Type or filename. Images are stored in the database
(assets.content), scoped per user; older uploads may still be files on disk.
"""
import uuid

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.asset import Asset
from app.models.user import User
from app.schemas.asset import AssetKind

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
JPEG_SIGNATURE = b"\xff\xd8\xff"
EXTENSIONS = {"image/png": ".png", "image/jpeg": ".jpg"}


class AssetTooLargeError(Exception):
    pass


class UnsupportedAssetTypeError(Exception):
    pass


def sniff_image_mime(data: bytes) -> str | None:
    if data.startswith(PNG_SIGNATURE):
        return "image/png"
    if data.startswith(JPEG_SIGNATURE):
        return "image/jpeg"
    return None


async def save_asset(db: AsyncSession, user: User, kind: AssetKind, upload: UploadFile) -> Asset:
    # Read one byte past the limit so oversize files are rejected without
    # buffering all of them
    data = await upload.read(settings.MAX_ASSET_BYTES + 1)
    if len(data) > settings.MAX_ASSET_BYTES:
        raise AssetTooLargeError
    mime_type = sniff_image_mime(data)
    if mime_type is None:
        raise UnsupportedAssetTypeError

    asset = Asset(
        user_id=user.id,
        kind=kind,
        content=data,
        storage_path=f"db/{user.id}/{uuid.uuid4().hex}{EXTENSIONS[mime_type]}",
        mime_type=mime_type,
        size_bytes=len(data),
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


async def get_user_asset(db: AsyncSession, user: User, asset_id: uuid.UUID) -> Asset | None:
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.user_id == user.id)
    )
    return result.scalars().first()


async def asset_bytes(db: AsyncSession, asset: Asset) -> bytes | None:
    """The image: from the database, or (older uploads) the file on disk."""
    await db.refresh(asset, ["content"])
    if asset.content is not None:
        return asset.content
    root = settings.ASSET_STORAGE_DIR.resolve()
    path = (root / asset.storage_path).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        return None
    return path.read_bytes()
