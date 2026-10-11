import uuid
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

from httpx import AsyncClient

from app.core.config import settings
from app.models.asset import Asset

Login = Callable[[str], Awaitable[dict[str, str]]]

# Only the signatures matter for type detection; the rest is filler
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"\x00" * 64


async def test_upload_png_and_fetch_it_back(
    client: AsyncClient, login: Login, asset_dir: Path
) -> None:
    headers = await login("owner@example.com")
    response = await client.post(
        "/assets", headers=headers, data={"kind": "logo"},
        files={"file": ("../../evil name.png", PNG_BYTES, "image/png")},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["kind"] == "logo"
    assert body["mime_type"] == "image/png"
    assert body["size_bytes"] == len(PNG_BYTES)

    # Kept in the database (free hosts wipe their disk), never as a file
    # named after the upload
    assert list(asset_dir.rglob("*")) == []

    fetched = await client.get(f"/assets/{body['id']}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.content == PNG_BYTES
    assert fetched.headers["content-type"] == "image/png"
    assert fetched.headers["x-content-type-options"] == "nosniff"


async def test_upload_jpeg_signature(client: AsyncClient, login: Login, asset_dir: Path) -> None:
    headers = await login("owner@example.com")
    response = await client.post(
        "/assets", headers=headers, data={"kind": "signature"},
        files={"file": ("sig.jpg", JPEG_BYTES, "image/jpeg")},
    )
    assert response.status_code == 201
    assert response.json()["mime_type"] == "image/jpeg"


async def test_rejects_non_png_jpg_even_with_image_content_type(
    client: AsyncClient, login: Login, asset_dir: Path
) -> None:
    headers = await login("owner@example.com")
    for content in [b"GIF89a" + b"\x00" * 32, b"<svg xmlns='http://www.w3.org/2000/svg'/>"]:
        response = await client.post(
            "/assets", headers=headers, data={"kind": "logo"},
            files={"file": ("logo.png", content, "image/png")},
        )
        assert response.status_code == 415
    assert list(asset_dir.rglob("*")) == []


async def test_rejects_files_over_the_size_limit(
    client: AsyncClient, login: Login, asset_dir: Path
) -> None:
    headers = await login("owner@example.com")
    too_big = PNG_BYTES + b"\x00" * settings.MAX_ASSET_BYTES
    response = await client.post(
        "/assets", headers=headers, data={"kind": "logo"},
        files={"file": ("big.png", too_big, "image/png")},
    )
    assert response.status_code == 413
    assert list(asset_dir.rglob("*")) == []


async def test_rejects_unknown_kind(client: AsyncClient, login: Login, asset_dir: Path) -> None:
    headers = await login("owner@example.com")
    response = await client.post(
        "/assets", headers=headers, data={"kind": "banner"},
        files={"file": ("logo.png", PNG_BYTES, "image/png")},
    )
    assert response.status_code == 422


async def test_requires_auth(client: AsyncClient, asset_dir: Path) -> None:
    response = await client.post(
        "/assets", data={"kind": "logo"}, files={"file": ("logo.png", PNG_BYTES, "image/png")}
    )
    assert response.status_code == 401


async def test_assets_are_private_to_their_owner(
    client: AsyncClient, login: Login, asset_dir: Path
) -> None:
    owner = await login("owner@example.com")
    other = await login("other@example.com")
    response = await client.post(
        "/assets", headers=owner, data={"kind": "logo"},
        files={"file": ("logo.png", PNG_BYTES, "image/png")},
    )
    asset_id = response.json()["id"]
    assert (await client.get(f"/assets/{asset_id}", headers=other)).status_code == 404
    assert (await client.get(f"/assets/{asset_id}", headers=owner)).status_code == 200


async def test_uploads_from_before_the_database_are_read_from_disk(
    client: AsyncClient, login: Login, asset_dir: Path, session_factory: Any
) -> None:
    headers = await login("old@example.com")
    uploaded = (await client.post("/assets", headers=headers, data={"kind": "logo"},
                                  files={"file": ("logo.png", PNG_BYTES, "image/png")})).json()
    # As stored by an earlier version: on disk, no content in the row
    (asset_dir / "legacy").mkdir()
    (asset_dir / "legacy" / "logo.png").write_bytes(PNG_BYTES)
    async with session_factory() as session:
        asset = await session.get(Asset, uuid.UUID(uploaded["id"]))
        asset.content = None
        asset.storage_path = "legacy/logo.png"
        await session.commit()
    fetched = await client.get(f"/assets/{uploaded['id']}", headers=headers)
    assert (fetched.status_code, fetched.content) == (200, PNG_BYTES)
