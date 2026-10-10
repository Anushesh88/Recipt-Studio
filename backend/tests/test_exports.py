"""PDF / PNG export, previews, and their limits (Phase 5)."""
import asyncio
import base64
import time
from collections.abc import Awaitable, Callable, Iterator
from pathlib import Path
from typing import Any

import pymupdf
import pytest
from httpx import AsyncClient

from app.api.rendering import export_limiter
from app.core.config import settings
from app.services import render_service
from tests.factories import PAGE, canvas, items_table, text, totals

Login = Callable[[str], Awaitable[dict[str, str]]]
Headers = dict[str, str]
PX_PER_PT = 4 / 3  # PDF points -> CSS px

PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _renderer_available() -> bool:
    try:
        render_service._load_weasyprint()
    except render_service.RendererUnavailableError:
        return False
    return True


requires_renderer = pytest.mark.skipif(
    not _renderer_available(), reason="WeasyPrint's GTK/Pango libraries aren't installed"
)


@pytest.fixture(autouse=True)
def isolated_exports(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(settings, "RECEIPT_STORAGE_DIR", tmp_path / "receipts")
    monkeypatch.setattr(settings, "ASSET_STORAGE_DIR", tmp_path / "assets")
    export_limiter.reset()
    yield
    export_limiter.reset()


def items(n: int) -> list[dict[str, str]]:
    return [{"description": f"Item {i + 1}", "qty": "1", "unit_price": "2.00"} for i in range(n)]


def receipt_data(n_items: int, **overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "customer": {"name": "Jane Doe"},
        "receipt": {"date": "2026-10-09", "currency": "USD"},
        "items": items(n_items),
        "tax_rate": "0.10",
    }
    data.update(overrides)
    return data


async def make_template(client: AsyncClient, headers: Headers, body: dict[str, Any]) -> str:
    response = await client.post("/templates", headers=headers, json={"name": "T", "canvas": body})
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


async def make_receipt(client: AsyncClient, headers: Headers, template_id: str, n_items: int) -> dict[str, Any]:
    response = await client.post(
        "/receipts", headers=headers, json={"template_id": template_id, "data": receipt_data(n_items)}
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def standard_canvas() -> dict[str, Any]:
    return canvas(text("title", "Hi {{customer.name}}"), items_table(y=60), totals(y=170))


def spans(pdf: bytes) -> list[tuple[str, tuple[float, float, float, float]]]:
    with pymupdf.open(stream=pdf, filetype="pdf") as doc:  # type: ignore[no-untyped-call]
        found = []
        for block in doc[0].get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    x0, y0, x1, y1 = (v * PX_PER_PT for v in span["bbox"])
                    found.append((span["text"], (x0, y0, x1, y1)))
        return found


def page_size_px(pdf: bytes) -> tuple[float, float]:
    with pymupdf.open(stream=pdf, filetype="pdf") as doc:  # type: ignore[no-untyped-call]
        rect = doc[0].rect
        return rect.width * PX_PER_PT, rect.height * PX_PER_PT


def inside(box: tuple[float, float, float, float], x: float, y: float, w: float, h: float, tol: float = 1) -> bool:
    x0, y0, x1, y1 = box
    return x0 >= x - tol and y0 >= y - tol and x1 <= x + w + tol and y1 <= y + h + tol


@requires_renderer
async def test_thermal_receipt_height_tracks_item_count(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template_id = await make_template(client, headers, standard_canvas())
    for n in (1, 5, 30):
        receipt = await make_receipt(client, headers, template_id, n)
        response = await client.get(f"/receipts/{receipt['id']}/export?format=pdf", headers=headers)
        assert response.status_code == 200, response.text
        assert response.headers["content-type"] == "application/pdf"
        assert response.headers["content-disposition"] == f'attachment; filename="receipt-{receipt["receipt_number"]}.pdf"'
        width, height = page_size_px(response.content)
        # 400px design height with 3 sample rows; each item is a 24px row
        assert (round(width), round(height)) == (302, 400 + (n - 3) * 24), n


@requires_renderer
async def test_pdf_positions_follow_the_layout(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template_id = await make_template(client, headers, standard_canvas())
    receipt = await make_receipt(client, headers, template_id, 5)
    pdf = (await client.get(f"/receipts/{receipt['id']}/export", headers=headers)).content
    found = dict(spans(pdf))

    assert inside(found["Hi Jane Doe"], 12, 12, 278, 32)
    # Table header and the 5th row sit inside the table, which grew to 6 rows
    assert inside(found["Item"], 12, 60, 278, 24)
    assert inside(found["Item 5"], 12, 60 + 5 * 24, 278, 24)
    # Totals were pushed down by the 2 extra rows (48px); each row is 13 * 1.4 -> 19px + 4px gap
    assert inside(found["Subtotal"], 120, 170 + 48, 170, 19)
    assert inside(found["$10.00"], 120, 170 + 48, 170, 19)
    assert inside(found["$11.00"], 120, 170 + 48 + 3 * 23, 170, 24)


@requires_renderer
async def test_all_seven_element_types_render(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    upload = await client.post(
        "/assets", headers=headers, data={"kind": "logo"}, files={"file": ("logo.png", PNG_1PX, "image/png")}
    )
    asset_id = upload.json()["id"]
    body = canvas(
        {"id": "logo", "type": "image", "x": 100, "y": 4, "width": 100, "height": 40, "zIndex": 1, "locked": False,
         "props": {"source": "logo", "assetId": asset_id, "fit": "contain"}},
        text("title", "Receipt {{receipt.number}}", y=48),
        items_table(y=84),
        totals(y=190),
        {"id": "qr", "type": "qr", "x": 12, "y": 190, "width": 90, "height": 90, "zIndex": 5, "locked": False,
         "props": {"content": "{{receipt.number}}", "errorCorrection": "M"}},
        {"id": "sig", "type": "signature", "x": 150, "y": 300, "width": 140, "height": 60, "zIndex": 6, "locked": False,
         "props": {"label": "Cashier", "assetId": asset_id, "lineColor": "#111111"}},
        {"id": "rule", "type": "divider", "x": 12, "y": 370, "width": 278, "height": 8, "zIndex": 7, "locked": False,
         "props": {"style": "dashed", "thickness": 2, "color": "#999999"}},
    )
    template_id = await make_template(client, headers, body)
    receipt = await make_receipt(client, headers, template_id, 3)
    pdf = (await client.get(f"/receipts/{receipt['id']}/export", headers=headers)).content

    texts = [t for t, _ in spans(pdf)]
    assert "Receipt R-0001" in texts and "Cashier" in texts and "Total" in texts and "Item 3" in texts
    with pymupdf.open(stream=pdf, filetype="pdf") as doc:  # type: ignore[no-untyped-call]
        page = doc[0]
        assert len(page.get_image_info()) == 2  # logo + signature image
        drawings = [d["rect"] for d in page.get_drawings()]
    # The QR's modules and the divider are vector drawings inside their boxes
    assert any(inside(tuple(v * PX_PER_PT for v in r), 12, 190, 90, 90) for r in drawings)
    assert any(inside(tuple(v * PX_PER_PT for v in r), 12, 370, 278, 8) for r in drawings)

    png = await client.get(f"/receipts/{receipt['id']}/export?format=png", headers=headers)
    assert png.status_code == 200
    assert png.content.startswith(b"\x89PNG")
    pixmap = pymupdf.Pixmap(png.content)  # type: ignore[no-untyped-call]
    assert (pixmap.width, pixmap.height) == (302 * 2, 400 * 2)  # 2x scale


@requires_renderer
async def test_exports_are_cached_and_private(client: AsyncClient, login: Login) -> None:
    owner = await login("owner@example.com")
    other = await login("other@example.com")
    template_id = await make_template(client, owner, standard_canvas())
    receipt = await make_receipt(client, owner, template_id, 2)
    path = f"/receipts/{receipt['id']}/export"

    first = await client.get(path, headers=owner)
    cached = list((settings.RECEIPT_STORAGE_DIR).rglob("*.pdf"))
    assert len(cached) == 1 and cached[0].read_bytes() == first.content
    second = await client.get(path, headers=owner)
    assert second.content == first.content
    assert (await client.get(path, headers=other)).status_code == 404


async def test_fixed_page_overflow_is_refused(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    a5 = {**PAGE, "preset": "a5", "width": 559, "height": 794, "heightMode": "fixed", "margin": 24}
    body = {"schemaVersion": 1, "page": a5, "elements": [items_table(y=500), totals(y=620)]}
    template_id = await make_template(client, headers, body)

    ok = await client.post("/receipts", headers=headers, json={"template_id": template_id, "data": receipt_data(3)})
    assert ok.status_code == 201
    too_many = await client.post("/receipts", headers=headers, json={"template_id": template_id, "data": receipt_data(20)})
    assert too_many.status_code == 422
    assert too_many.json()["detail"]["code"] == "CONTENT_OVERFLOW"
    assert "A5" in too_many.json()["detail"]["message"]
    preview = await client.post("/preview", headers=headers, json={"canvas": body, "data": receipt_data(20), "format": "html"})
    assert preview.status_code == 422
    # The refused receipt didn't use up a number
    assert (await client.get("/receipts/next-number", headers=headers)).json()["next_number"] == "R-0002"


async def test_preview_html_treats_values_as_plain_text(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    body = canvas(text("t", "Hi {{customer.name}} / {{custom.note}}"), items_table(y=60), totals(y=170))
    data = receipt_data(
        1,
        customer={"name": "<script>alert(1)</script>"},
        custom={"note": "{{ 7*7 }} {{receipt.number}}"},
    )
    response = await client.post("/preview", headers=headers, json={"canvas": body, "data": data, "format": "html"})
    assert response.status_code == 200
    html = response.text
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html and "<script>" not in html
    # Values are data, never template source: no evaluation, no second substitution
    assert "{{ 7*7 }} {{receipt.number}}" in html and "49" not in html
    # A preview shows the next number without consuming it
    assert (await client.get("/receipts/next-number", headers=headers)).json()["next_number"] == "R-0001"


async def test_exports_are_rate_limited(client: AsyncClient, login: Login, monkeypatch: pytest.MonkeyPatch) -> None:
    headers = await login("owner@example.com")
    monkeypatch.setattr(export_limiter, "limit", 2)
    request = {"canvas": standard_canvas(), "data": receipt_data(1), "format": "html"}
    for _ in range(2):
        assert (await client.post("/preview", headers=headers, json=request)).status_code == 200
    limited = await client.post("/preview", headers=headers, json=request)
    assert limited.status_code == 429
    assert limited.json()["detail"]["code"] == "RATE_LIMITED"
    assert int(limited.headers["retry-after"]) >= 1
    # Limits are per user
    other = await login("other@example.com")
    assert (await client.post("/preview", headers=other, json=request)).status_code == 200


async def test_missing_renderer_is_a_clear_503(client: AsyncClient, login: Login, monkeypatch: pytest.MonkeyPatch) -> None:
    headers = await login("owner@example.com")

    def unavailable() -> None:
        raise render_service.RendererUnavailableError("no pango")

    monkeypatch.setattr(render_service, "_load_weasyprint", unavailable)
    response = await client.post(
        "/preview", headers=headers, json={"canvas": standard_canvas(), "data": receipt_data(1), "format": "pdf"}
    )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "RENDERER_UNAVAILABLE"


async def test_preview_of_an_overfull_qr_code_is_422(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    qr = {"id": "qr", "type": "qr", "x": 12, "y": 200, "width": 90, "height": 90, "zIndex": 4, "locked": False,
          "props": {"content": "{{custom.a}}{{custom.b}}{{custom.c}}", "errorCorrection": "H"}}
    data = receipt_data(1, custom={k: "x" * 500 for k in "abc"})
    response = await client.post("/preview", headers=headers, json={"canvas": canvas(qr), "data": data, "format": "html"})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "QR_CONTENT_TOO_LONG"


async def test_rendering_does_not_hold_up_other_requests(
    client: AsyncClient, login: Login, monkeypatch: pytest.MonkeyPatch
) -> None:
    headers = await login("owner@example.com")

    def slow_render(html: str) -> bytes:
        time.sleep(0.6)  # a big receipt
        return b"%PDF-1.7 fake"

    monkeypatch.setattr(render_service, "render_pdf", slow_render)
    request = {"canvas": standard_canvas(), "data": receipt_data(1), "format": "pdf"}
    started = time.perf_counter()
    render = asyncio.create_task(client.post("/preview", headers=headers, json=request))
    await asyncio.sleep(0.1)  # the render is under way

    assert (await client.get("/health")).status_code == 200
    # Timed from the start: a render on the event loop would hold this for 0.6 s
    assert time.perf_counter() - started < 0.45, "/health waited for the render"
    assert not render.done()
    assert (await render).status_code == 200
