"""The sales report (GET /reports/sales) and private receipt links for WhatsApp
(POST /receipts/{id}/share-link, GET /public/receipts/{token})."""
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from httpx import AsyncClient
from jose import jwt

from app.api.rendering import export_limiter
from app.core.config import settings
from app.services import share_service
from tests.factories import canvas, items_table, text, totals
from tests.test_exports import requires_renderer
from tests.test_gst import (
    Headers,
    Login,
    create,
    gst_seller,
    gst_template,
    invoice_data,
)


@pytest.fixture(autouse=True)
def isolated(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setattr(settings, "RECEIPT_STORAGE_DIR", tmp_path / "receipts")
    export_limiter.reset()
    yield
    export_limiter.reset()


async def receipt_template(client: AsyncClient, headers: Headers) -> str:
    response = await client.post(
        "/templates", headers=headers,
        json={"name": "Shop", "canvas": canvas(text("title", "Receipt {{receipt.number}}"), items_table(y=60), totals(y=170))},
    )
    assert response.status_code == 201
    return str(response.json()["id"])


def sale(date: str, items: list[tuple[str, str, str]], currency: str = "INR", **extra: Any) -> dict[str, Any]:
    return {
        "receipt": {"date": date, "currency": currency},
        "items": [{"description": d, "qty": q, "unit_price": p} for d, q, p in items],
        **extra,
    }


async def report(client: AsyncClient, headers: Headers, **params: str) -> dict[str, Any]:
    response = await client.get("/reports/sales", headers=headers, params=params)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


async def test_sales_report_adds_up_items_and_totals_over_the_period(client: AsyncClient, login: Login) -> None:
    headers = await gst_seller(client, login)
    shop = await receipt_template(client, headers)
    invoice = await gst_template(client, headers)
    for data in (
        sale("2026-10-01", [("Masala chai", "2", "20"), ("Samosa", "3", "15")], tax_rate="0.05", discount="5"),
        sale("2026-10-15", [("masala chai ", "1", "20")]),  # same item, however it's typed
        sale("2026-11-02", [("Masala chai", "10", "20")]),  # outside the period
        sale("2026-10-20", [("Masala chai", "1", "3")], currency="USD"),  # another currency
    ):
        assert (await create(client, headers, shop, data)).status_code == 201
    assert (await create(client, headers, invoice, invoice_data())).status_code == 201  # 2 x 500 rice at 5%, 2026-10-09

    body = await report(client, headers, start="2026-10-01", end="2026-10-31")
    assert (body["currency"], body["currencies"], body["receipt_count"]) == ("INR", ["INR", "USD"], 3)
    assert [(i["description"], i["unit"], i["quantity"], i["amount"], i["receipts"]) for i in body["items"]] == [
        ("Basmati rice 5 kg", "BAG", "2", "1000.00", 1),
        ("masala chai", None, "3", "60.00", 2),  # named as on the latest receipt
        ("Samosa", None, "3", "45.00", 1),
    ]
    # Receipts: 85 (5 off, 5% of 80 = 4.00 tax) + 20; the invoice: 1000 + 25 CGST + 25 SGST
    assert body["totals"] == {
        "subtotal": "1105.00", "discount": "5.00", "taxable": "1100.00", "tax": "54.00",
        "cgst": "25.00", "sgst": "25.00", "igst": "0.00", "total": "1154.00",
    }

    usd = await report(client, headers, start="2026-10-01", end="2026-10-31", currency="usd")
    assert (usd["currency"], usd["receipt_count"], usd["totals"]["total"]) == ("USD", 1, "3.00")
    gst_only = await report(client, headers, start="2026-10-01", end="2026-10-31", document_type="gst_invoice")
    assert (gst_only["receipt_count"], gst_only["totals"]["tax"]) == (1, "50.00")
    empty = await report(client, headers, start="2025-01-01", end="2025-01-31")
    assert (empty["currency"], empty["items"], empty["totals"]["total"]) == (None, [], "0")


async def test_sales_report_is_per_account_and_checks_the_period(client: AsyncClient, login: Login) -> None:
    mine = await login("mine@example.com")
    shop = await receipt_template(client, mine)
    await create(client, mine, shop, sale("2026-10-01", [("Tea", "1", "10")]))
    other = await login("other@example.com")
    assert (await report(client, other, start="2026-10-01", end="2026-10-31"))["receipt_count"] == 0

    backwards = await client.get("/reports/sales", headers=mine, params={"start": "2026-10-31", "end": "2026-10-01"})
    assert backwards.status_code == 422
    too_long = await client.get("/reports/sales", headers=mine, params={"start": "2020-01-01", "end": "2026-01-01"})
    assert too_long.status_code == 422
    assert (await client.get("/reports/sales", params={"start": "2026-10-01", "end": "2026-10-31"})).status_code == 401


@requires_renderer
async def test_a_share_link_opens_just_that_receipt_without_signing_in(client: AsyncClient, login: Login) -> None:
    headers = await login("links@example.com")
    shop = await receipt_template(client, headers)
    receipt = (await create(client, headers, shop, sale("2026-10-01", [("Tea", "1", "10")]))).json()

    link = await client.post(f"/receipts/{receipt['id']}/share-link", headers=headers)
    assert link.status_code == 200
    path = link.json()["path"]
    assert path == f"/public/receipts/{link.json()['token']}"
    pdf = await client.get(path)  # no Authorization header
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.headers["content-disposition"].startswith("inline;")
    assert pdf.headers["x-robots-tag"] == "noindex"

    # Only the owner can make a link
    other = await login("someone@example.com")
    assert (await client.post(f"/receipts/{receipt['id']}/share-link", headers=other)).status_code == 404


async def test_share_links_cant_be_forged_or_swapped(client: AsyncClient, login: Login) -> None:
    headers = await login("forger@example.com")
    shop = await receipt_template(client, headers)
    receipt = (await create(client, headers, shop, sale("2026-10-01", [("Tea", "1", "10")]))).json()
    assert (await client.get("/public/receipts/not-a-token")).status_code == 404
    # Signed with another key
    forged = jwt.encode({"rid": receipt["id"], "purpose": share_service.PURPOSE}, "not-the-key", algorithm="HS256")
    assert (await client.get(f"/public/receipts/{forged}")).status_code == 404
    # A login token is signed with the same key, but isn't a receipt link
    login_token = headers["Authorization"].removeprefix("Bearer ")
    assert (await client.get(f"/public/receipts/{login_token}")).status_code == 404
