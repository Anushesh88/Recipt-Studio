"""GST tax invoices (CGST rule 46), the account's GST profile, and saved customers / items."""
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

import pytest
from httpx import AsyncClient

from app.api.rendering import export_limiter
from app.core.config import settings
from tests.factories import PAGE, gst_canvas, text
from tests.test_exports import requires_renderer, spans

Login = Callable[[str], Awaitable[dict[str, str]]]
Headers = dict[str, str]

SUPPLIER_GSTIN = "27AAPFU0939F1ZV"  # Maharashtra (27)
BUYER_GSTIN = "29AAGCB7383J1Z4"     # Karnataka (29)
PROFILE = {"business_name": "Sharma Traders", "business_address": "12 MG Road, Pune", "gstin": SUPPLIER_GSTIN}


@pytest.fixture(autouse=True)
def fresh_limits() -> None:
    export_limiter.reset()


def has(actual: dict[str, Any], expected: dict[str, Any]) -> bool:
    """`actual` includes every key / value of `expected`."""
    return expected.items() <= actual.items()


async def gst_seller(client: AsyncClient, login: Login, email: str = "seller@example.com") -> Headers:
    headers = await login(email)
    response = await client.patch("/auth/me", headers=headers, json=PROFILE)
    assert response.status_code == 200, response.text
    return headers


async def gst_template(client: AsyncClient, headers: Headers, **kwargs: Any) -> str:
    response = await client.post("/templates", headers=headers, json={"name": "Invoice", "canvas": gst_canvas(**kwargs)})
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


def invoice_data(**overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "customer": {"name": "Walk-in customer"},
        "receipt": {"date": "2026-10-09", "currency": "INR"},
        "items": [{"description": "Basmati rice 5 kg", "qty": "2", "unit_price": "500.00", "unit": "BAG",
                   "hsn": "1006", "gst_rate": "5"}],
    }
    data.update(overrides)
    return data


async def create(client: AsyncClient, headers: Headers, template_id: str, data: dict[str, Any]) -> Any:
    return await client.post("/receipts", headers=headers, json={"template_id": template_id, "data": data})


async def next_invoice_number(client: AsyncClient, headers: Headers) -> str:
    preview = await client.get(
        "/receipts/next-number", headers=headers, params={"document_type": "gst_invoice", "date": "2026-10-09"}
    )
    return str(preview.json()["next_number"])


# --- Settings ----------------------------------------------------------------------

async def test_gst_profile_is_validated(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    typo = await client.patch("/auth/me", headers=headers, json={"gstin": "27AAPFU0939F1ZX"})
    assert typo.status_code == 422
    assert "last character" in typo.text
    for prefix in ("INV 1", "TOOLONG1", "INV#"):
        assert (await client.patch("/auth/me", headers=headers, json={"invoice_prefix": prefix})).status_code == 422

    saved = await client.patch("/auth/me", headers=headers, json={**PROFILE, "gstin": SUPPLIER_GSTIN.lower()})
    assert saved.status_code == 200
    assert has(saved.json(), {"gstin": SUPPLIER_GSTIN, "business_address": "12 MG Road, Pune", "invoice_prefix": "INV/"})
    cleared = await client.patch("/auth/me", headers=headers, json={"gstin": ""})
    assert cleared.json()["gstin"] is None


# --- Templates ---------------------------------------------------------------------

async def test_gst_templates_must_show_every_particular(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    incomplete = gst_canvas()
    incomplete["elements"] = [e for e in incomplete["elements"] if e["id"] not in ("sig", "supply")]
    response = await client.post("/templates", headers=headers, json={"name": "Bad", "canvas": incomplete})
    assert response.status_code == 422
    for missing in ("Place of supply (state)", "Reverse charge (Yes / No)", "Signature"):
        assert missing in response.text
    # The same elements are fine on a plain receipt
    incomplete["documentType"] = "receipt"
    assert (await client.post("/templates", headers=headers, json={"name": "Ok", "canvas": incomplete})).status_code == 201


# --- Issuing invoices ---------------------------------------------------------------

async def test_gst_invoices_need_the_profile(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template_id = await gst_template(client, headers)
    response = await create(client, headers, template_id, invoice_data())
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "GST_PROFILE_INCOMPLETE"


async def test_intra_state_invoice_cgst_sgst_and_numbering(client: AsyncClient, login: Login) -> None:
    headers = await gst_seller(client, login)
    template_id = await gst_template(client, headers)
    assert await next_invoice_number(client, headers) == "INV/26-27/0001"

    first = await create(client, headers, template_id, invoice_data())
    assert first.status_code == 201, first.text
    body = first.json()
    assert body["document_type"] == "gst_invoice"
    assert body["receipt_number"] == "INV/26-27/0001"
    assert body["currency"] == "INR"
    # The supplier's details come from Settings, whatever the form sent
    assert body["data"]["business"] == {"name": "Sharma Traders", "address": "12 MG Road, Pune", "gstin": SUPPLIER_GSTIN}
    # A walk-in sale: the place of supply defaults to the supplier's state
    assert body["data"]["receipt"]["place_of_supply"] == "27"
    assert body["data"]["computed"] == {
        "subtotal": "1000.00", "tax": "50.00", "discount": "0.00", "total": "1050.00",
        "gst": {"supply": "intra", "state_tax_label": "SGST", "taxable": "1000.00",
                "cgst": "25.00", "sgst": "25.00", "igst": "0.00"},
    }
    item = body["data"]["items"][0]
    assert (item["line_total"], item["taxable_value"], item["tax_amount"]) == ("1000.00", "1000.00", "50.00")

    second = await create(client, headers, template_id, invoice_data())
    assert second.json()["receipt_number"] == "INV/26-27/0002"
    # A new financial year starts a new series; dates before April stay in the old one
    april = await create(client, headers, template_id, invoice_data(receipt={"date": "2027-04-01", "currency": "INR"}))
    assert april.json()["receipt_number"] == "INV/27-28/0001"
    march = await create(client, headers, template_id, invoice_data(receipt={"date": "2027-03-31", "currency": "INR"}))
    assert march.json()["receipt_number"] == "INV/26-27/0003"


async def test_b2b_inter_state_invoice_uses_igst_and_needs_details(client: AsyncClient, login: Login) -> None:
    headers = await gst_seller(client, login)
    template_id = await gst_template(client, headers)
    b2b = invoice_data(
        customer={"name": "Bangalore Stores", "gstin": BUYER_GSTIN.lower()},
        items=[{"description": "Ghee 1 L", "qty": "10", "unit_price": "600.00", "gst_rate": "5"}],
    )
    refused = await create(client, headers, template_id, b2b)
    assert refused.status_code == 422
    detail = refused.json()["detail"]
    assert detail["code"] == "GST_DETAILS_REQUIRED"
    assert detail["fields"] == ["customer.address", "items.0.hsn"]

    b2b["customer"]["address"] = "4 Brigade Road, Bengaluru"
    b2b["items"][0]["hsn"] = "0405"
    created = await create(client, headers, template_id, b2b)
    assert created.status_code == 201, created.text
    data = created.json()["data"]
    assert data["customer"]["gstin"] == BUYER_GSTIN
    assert data["receipt"]["place_of_supply"] == "29"  # the buyer's GSTIN state
    assert has(data["computed"]["gst"], {"supply": "inter", "igst": "300.00", "cgst": "0.00", "sgst": "0.00"})
    assert data["computed"]["total"] == "6300.00"


async def test_unregistered_buyer_details_from_50000(client: AsyncClient, login: Login) -> None:
    headers = await gst_seller(client, login)
    template_id = await gst_template(client, headers)
    big = [{"description": "Laptop", "qty": "1", "unit_price": "50000.00", "gst_rate": "18"}]
    refused = await create(client, headers, template_id, invoice_data(customer={}, items=big))
    assert refused.status_code == 422
    assert refused.json()["detail"]["fields"] == ["customer.name", "customer.address"]
    # Just under the threshold, a walk-in sale needs no buyer details
    small = [{"description": "Laptop", "qty": "1", "unit_price": "49999.99", "gst_rate": "18"}]
    assert (await create(client, headers, template_id, invoice_data(customer={}, items=small))).status_code == 201
    ok = await create(client, headers, template_id, invoice_data(
        customer={"name": "Asha Rao", "address": "7 Park Street, Kolkata"},
        receipt={"date": "2026-10-09", "currency": "INR", "place_of_supply": "19"}, items=big,
    ))
    assert ok.status_code == 201, ok.text
    assert ok.json()["data"]["computed"]["gst"]["igst"] == "9000.00"


@pytest.mark.parametrize(("change", "code", "fields"), [
    ({"receipt": {"date": "2026-10-09", "currency": "USD"}}, "GST_CURRENCY", ["receipt.currency"]),
    ({"tax_rate": "0.18"}, "GST_PER_ITEM", ["tax_rate"]),
    ({"items": [{"description": "Tea", "qty": "1", "unit_price": "10.00"}]}, "GST_DETAILS_REQUIRED", ["items.0.gst_rate"]),
    ({"items": []}, "GST_DETAILS_REQUIRED", ["items"]),
    ({"items": [{"description": "Tea", "qty": "1", "unit_price": "10.00", "gst_rate": "5", "discount": "11.00"}]},
     "DISCOUNT_TOO_LARGE", ["items.0.discount"]),
    ({"receipt": {"date": "2026-10-09", "currency": "INR", "number": "INV 7"}}, "INVOICE_NUMBER_INVALID", ["receipt.number"]),
    ({"receipt": {"date": "2026-10-09", "currency": "INR", "number": "INV/2026-27/00001"}}, "INVOICE_NUMBER_INVALID",
     ["receipt.number"]),
])
async def test_gst_invoice_rules(
    client: AsyncClient, login: Login, change: dict[str, Any], code: str, fields: list[str]
) -> None:
    headers = await gst_seller(client, login)
    template_id = await gst_template(client, headers)
    response = await create(client, headers, template_id, invoice_data(**change))
    assert response.status_code == 422, response.text
    assert (response.json()["detail"]["code"], response.json()["detail"]["fields"]) == (code, fields)
    # Nothing was used up
    assert await next_invoice_number(client, headers) == "INV/26-27/0001"


async def test_invoice_number_override(client: AsyncClient, login: Login) -> None:
    headers = await gst_seller(client, login)
    template_id = await gst_template(client, headers)
    manual = invoice_data(receipt={"date": "2026-10-09", "currency": "INR", "number": "B2/26-27/0042"})
    assert (await create(client, headers, template_id, manual)).json()["receipt_number"] == "B2/26-27/0042"
    assert (await create(client, headers, template_id, manual)).status_code == 409
    # The automatic series wasn't touched
    assert (await create(client, headers, template_id, invoice_data())).json()["receipt_number"] == "INV/26-27/0001"


async def test_gst_invoice_page_shows_the_tax_split(client: AsyncClient, login: Login) -> None:
    headers = await gst_seller(client, login)
    request = {"canvas": gst_canvas(), "data": invoice_data(), "format": "html"}
    html = (await client.post("/preview", headers=headers, json=request)).text
    for shown in ("Sharma Traders", SUPPLIER_GSTIN, "INV/26-27/0001", "Maharashtra (27)", "Unregistered",
                  "Reverse charge: No", ">CGST<", ">SGST<", "₹25.00", "₹1050.00", "5%", "2 BAG", "1006"):
        assert shown in html, shown
    assert ">IGST<" not in html

    inter = {**request, "data": invoice_data(receipt={"date": "2026-10-09", "currency": "INR", "place_of_supply": "24"})}
    html = (await client.post("/preview", headers=headers, json=inter)).text
    assert ">IGST<" in html and ">CGST<" not in html and "Gujarat (24)" in html


# --- Saved customers and items ------------------------------------------------------

async def test_customers_and_items_are_remembered(client: AsyncClient, login: Login) -> None:
    headers = await gst_seller(client, login)
    template_id = await gst_template(client, headers)
    await create(client, headers, template_id, invoice_data(
        customer={"name": "Bangalore Stores", "gstin": BUYER_GSTIN, "address": "4 Brigade Road"},
        items=[{"description": "Ghee 1 L", "qty": "1", "unit_price": "600.00", "hsn": "0405", "unit": "LTR",
                "gst_rate": "5"}],
    ))
    # The same customer and item in other case, at a new price; details not sent are kept
    await create(client, headers, template_id, invoice_data(
        customer={"name": "bangalore stores", "gstin": BUYER_GSTIN, "address": "4 Brigade Road"},
        items=[{"description": "GHEE 1 L", "qty": "1", "unit_price": "620.00", "hsn": "0405", "gst_rate": "5"}],
    ))
    customers = (await client.get("/customers", headers=headers)).json()
    assert len(customers) == 1
    assert has(customers[0], {"name": "bangalore stores", "gstin": BUYER_GSTIN, "address": "4 Brigade Road",
                              "state_code": "29"})
    items = (await client.get("/items", headers=headers)).json()
    assert [(i["description"], i["unit_price"], i["unit"], i["hsn"], i["gst_rate"]) for i in items] == [
        ("GHEE 1 L", "620.00", "LTR", "0405", "5.00"),
    ]

    other = await login("other@example.com")
    assert (await client.get("/customers", headers=other)).json() == []
    assert (await client.delete(f"/customers/{customers[0]['id']}", headers=other)).status_code == 404
    assert (await client.delete(f"/customers/{customers[0]['id']}", headers=headers)).status_code == 204
    assert (await client.delete(f"/items/{items[0]['id']}", headers=headers)).status_code == 204
    assert (await client.get("/customers", headers=headers)).json() == []


async def test_plain_receipts_ignore_gst_line_fields(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    created = await client.post("/templates", headers=headers, json={"name": "R", "canvas": {
        "schemaVersion": 1, "page": PAGE, "elements": [text("t", "Hi")],
    }})
    template_id = created.json()["id"]
    item = {"description": "Tea", "qty": "1", "unit_price": "10.00", "hsn": "0902", "gst_rate": "5", "discount": "1.00"}
    response = await create(client, headers, template_id, {"items": [item]})
    assert response.status_code == 201, response.text
    stored = response.json()["data"]
    assert stored["computed"]["total"] == "10.00"
    assert has(stored["items"][0], {"hsn": None, "gst_rate": None, "discount": "0.00", "taxable_value": None})


@requires_renderer
async def test_issued_invoice_pdf(
    client: AsyncClient, login: Login, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "RECEIPT_STORAGE_DIR", tmp_path)
    headers = await gst_seller(client, login)
    template_id = await gst_template(client, headers)
    receipt = (await create(client, headers, template_id, invoice_data())).json()
    pdf = await client.get(f"/receipts/{receipt['id']}/export", headers=headers, params={"format": "pdf"})
    assert pdf.status_code == 200
    assert 'filename="receipt-INV_26-27_0001.pdf"' in pdf.headers["content-disposition"]
    text_on_page = " ".join(span for span, _ in spans(pdf.content))
    for shown in ("Tax Invoice INV/26-27/0001", SUPPLIER_GSTIN, "Unregistered", "CGST", "SGST", "₹1050.00", "1006"):
        assert shown in text_on_page, shown
