"""The "Pay by UPI" QR: {{receipt.upi_link}} and {{receipt.total}}."""
from decimal import Decimal
from typing import Any

from httpx import AsyncClient

from app.services.receipt_service import upi_link
from tests.factories import canvas, items_table, text, totals
from tests.test_gst import Login

UPI_QR = {
    "id": "upi", "type": "qr", "x": 12, "y": 260, "width": 96, "height": 96, "zIndex": 5, "locked": False,
    "props": {"content": "{{receipt.upi_link}}", "errorCorrection": "M"},
}


def test_upi_link_has_the_payee_amount_and_note() -> None:
    link = upi_link("brewbloom@okhdfc", "Brew & Bloom Café", Decimal("588.5"), "INR", "Receipt R-0001")
    assert link == "upi://pay?pa=brewbloom@okhdfc&pn=Brew%20%26%20Bloom%20Caf%C3%A9&am=588.50&cu=INR&tn=Receipt%20R-0001"


def test_upi_link_without_an_id_or_rupees() -> None:
    assert upi_link(None, "Shop", Decimal("10"), "INR", "Receipt") == ""
    # UPI only takes rupees: other currencies leave the amount for the payer to type
    assert "am=" not in upi_link("shop@upi", "Shop", Decimal("10"), "USD", "Receipt")
    assert "am=" not in upi_link("shop@upi", "Shop", Decimal("0"), "INR", "Receipt")


async def preview(client: AsyncClient, headers: dict[str, str], *elements: dict[str, Any]) -> str:
    data = {
        "business": {"name": "Brew & Bloom"}, "receipt": {"date": "2026-10-14", "currency": "INR"},
        "items": [{"description": "Tea", "qty": "2", "unit_price": "20"}],
    }
    body = {"canvas": canvas(*elements, items_table(y=120), totals(y=200)), "data": data, "format": "html"}
    response = await client.post("/preview", headers=headers, json=body)
    assert response.status_code == 200, response.text
    return response.text


async def test_upi_qr_appears_once_there_is_a_upi_id(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    caption = text("caption", "Total {{receipt.total}}\nScan to pay by UPI: {{business.upi_id}}", y=12)
    html = await preview(client, headers, UPI_QR, caption)
    assert "<svg" not in html  # no UPI ID yet: no code, and no caption line
    assert "Total 40.00" in html and "Scan to pay" not in html

    await client.patch("/auth/me", headers=headers, json={"upi_id": "brewbloom@okhdfc"})
    html = await preview(client, headers, UPI_QR, caption)
    assert "<svg" in html
    assert "Scan to pay by UPI: brewbloom@okhdfc" in html


async def test_receipts_with_a_upi_qr_are_issued(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    await client.patch("/auth/me", headers=headers, json={"upi_id": "brewbloom@okhdfc"})
    template = await client.post("/templates", headers=headers, json={
        "name": "Cafe", "canvas": canvas(text("title", "{{business.name}}"), items_table(y=60), totals(y=170), UPI_QR),
    })
    receipt = await client.post("/receipts", headers=headers, json={"template_id": template.json()["id"], "data": {
        "business": {"name": "Brew & Bloom"}, "receipt": {"currency": "INR"},
        "items": [{"description": "Tea", "qty": "1", "unit_price": "20"}],
    }})
    # The link isn't a form field: the server works it out
    assert receipt.status_code == 201, receipt.text
