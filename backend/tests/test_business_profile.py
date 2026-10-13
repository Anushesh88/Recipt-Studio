"""The business profile (phone, email, UPI ID, PAN, bank details, licence) and
the brand kit (logo, colour, fonts) in Settings, and how templates print them."""
from typing import Any

from httpx import AsyncClient

from app.services import variables_service
from tests.factories import canvas, items_table, text, totals
from tests.test_assets import PNG_BYTES
from tests.test_gst import Headers, Login, create

PROFILE = {
    "business_name": "Brew & Bloom",
    "business_phone": "+91 98765 43210",
    "business_email": "hello@brewbloom.in",
    "upi_id": "brewbloom@okhdfc",
    "pan": "aapfu0939f",
    "bank_details": "HDFC Bank, A/c 50100123456789, IFSC HDFC0001234",
    "licence": "FSSAI 11521999000123",
}

CONTACT = "{{business.name}}\nPhone: {{business.phone}}\nEmail: {{business.email}}\n{{business.licence}}\nPAN {{business.pan}}"


def logo_box() -> dict[str, Any]:
    return {
        "id": "logo", "type": "image", "x": 12, "y": 200, "width": 80, "height": 40, "zIndex": 2, "locked": False,
        "props": {"source": "logo", "assetId": None, "fit": "contain"},
    }


async def preview_html(client: AsyncClient, headers: Headers, *elements: dict[str, Any]) -> str:
    data = {"receipt": {"date": "2026-10-13", "currency": "INR"}, "items": [{"description": "Tea", "qty": "1", "unit_price": "20"}]}
    body = {"canvas": canvas(*elements, items_table(y=120), totals(y=230)), "data": data, "format": "html"}
    response = await client.post("/preview", headers=headers, json=body)
    assert response.status_code == 200, response.text
    return response.text


async def test_settings_save_and_clear_the_profile(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    saved = (await client.patch("/auth/me", headers=headers, json=PROFILE)).json()
    assert saved["pan"] == "AAPFU0939F"
    assert saved["upi_id"] == "brewbloom@okhdfc"
    assert saved["licence"] == "FSSAI 11521999000123"

    cleared = (await client.patch("/auth/me", headers=headers, json={"business_phone": "", "pan": ""})).json()
    assert cleared["business_phone"] is None and cleared["pan"] is None
    assert cleared["business_email"] == "hello@brewbloom.in"  # untouched


async def test_settings_refuse_malformed_details(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    for field, value in [("upi_id", "not a upi"), ("pan", "12345"), ("business_phone", "call me"),
                         ("business_email", "nope"), ("brand_color", "red"), ("brand_fonts", "comic-sans")]:
        response = await client.patch("/auth/me", headers=headers, json={field: value})
        assert response.status_code == 422, field


async def test_receipts_print_the_profile_and_skip_empty_lines(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    await client.patch("/auth/me", headers=headers, json={"business_name": "Brew & Bloom", "business_phone": "+91 98765 43210"})
    html = await preview_html(client, headers, text("contact", CONTACT, y=12))
    assert "Phone: +91 98765 43210" in html
    # No email, licence or PAN in Settings: those lines aren't printed at all
    assert "Email:" not in html and "PAN" not in html

    template = await client.post("/templates", headers=headers, json={"name": "Shop", "canvas": canvas(text("contact", CONTACT), items_table(y=120), totals(y=230))})
    receipt = await create(client, headers, template.json()["id"], {
        "business": {"name": "Brew & Bloom"}, "receipt": {"date": "2026-10-13", "currency": "INR"},
        "items": [{"description": "Tea", "qty": "1", "unit_price": "20"}],
    })
    assert receipt.status_code == 201, receipt.text
    # The receipt keeps the details it was issued with
    assert receipt.json()["data"]["business"]["phone"] == "+91 98765 43210"


def test_resolve_leaves_out_profile_lines_with_nothing_to_show() -> None:
    values = {"business.phone": "98765 43210", "business.email": "", "customer.name": ""}
    text_in = "Phone: {{business.phone}}\nEmail: {{business.email}}\nDear {{customer.name}}\n{{business.email}} {{business.phone}}"
    # A line without profile details stays, even when empty; one with any value stays
    assert variables_service.resolve(text_in, values) == "Phone: 98765 43210\nDear \n 98765 43210"


async def test_logo_boxes_show_the_brand_logo(client: AsyncClient, login: Login, asset_dir: object) -> None:
    headers = await login("owner@example.com")
    html = await preview_html(client, headers, logo_box())
    assert "data:image/png;base64" not in html

    upload = await client.post("/assets", headers=headers, data={"kind": "logo"}, files={"file": ("logo.png", PNG_BYTES, "image/png")})
    logo = upload.json()["id"]
    saved = await client.patch("/auth/me", headers=headers, json={"brand_logo_asset_id": logo, "brand_color": "#7C3AED", "brand_fonts": "poppins-inter"})
    assert saved.status_code == 200, saved.text
    assert saved.json()["brand_color"] == "#7C3AED"
    assert "data:image/png;base64" in await preview_html(client, headers, logo_box())


async def test_brand_logo_must_be_your_own_upload(client: AsyncClient, login: Login, asset_dir: object) -> None:
    other = await login("other@example.com")
    upload = await client.post("/assets", headers=other, data={"kind": "logo"}, files={"file": ("logo.png", PNG_BYTES, "image/png")})
    headers = await login("owner@example.com")
    response = await client.patch("/auth/me", headers=headers, json={"brand_logo_asset_id": upload.json()["id"]})
    assert response.status_code == 422
