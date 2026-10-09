import re
from collections.abc import Awaitable, Callable
from typing import Any

from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.user import User
from tests.factories import canvas, items_table, text, totals

Login = Callable[[str], Awaitable[dict[str, str]]]
Headers = dict[str, str]

ITEMS = [{"description": "Latte", "qty": "2", "unit_price": "4.50"}]


async def make_template(client: AsyncClient, headers: Headers, *elements: dict[str, Any]) -> str:
    body = canvas(*elements) if elements else canvas(
        text("hello", "Hi {{customer.name}} at table {{custom.table_no}} ({{receipt.notes}})"),
        items_table(),
        totals(),
    )
    response = await client.post("/templates", headers=headers, json={"name": "Cafe", "canvas": body})
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


def receipt_data(number: str | None = None, **overrides: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "customer": {"name": "Jane Doe"},
        "receipt": {"number": number, "date": "2026-10-09", "currency": "USD"},
        "custom": {"table_no": "12"},
        "items": ITEMS,
        "tax_rate": "0.08",
        "discount": "0.00",
    }
    data.update(overrides)
    return data


async def create(client: AsyncClient, headers: Headers, template_id: str, data: dict[str, Any]) -> Any:
    return await client.post("/receipts", headers=headers, json={"template_id": template_id, "data": data})


async def test_blank_numbers_count_up_and_preview_does_not_consume(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template_id = await make_template(client, headers)

    for _ in range(2):  # previewing twice changes nothing
        preview = (await client.get("/receipts/next-number", headers=headers)).json()
        assert preview == {"mode": "sequential", "next_number": "R-0001"}

    first = await create(client, headers, template_id, receipt_data())
    assert first.status_code == 201, first.text
    assert first.json()["receipt_number"] == "R-0001"
    second = await create(client, headers, template_id, receipt_data(number="   "))  # whitespace = blank
    assert second.json()["receipt_number"] == "R-0002"
    assert (await client.get("/receipts/next-number", headers=headers)).json()["next_number"] == "R-0003"


async def test_override_is_used_as_is_and_does_not_consume(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template_id = await make_template(client, headers)

    custom = await create(client, headers, template_id, receipt_data(number="INV-7"))
    assert custom.json()["receipt_number"] == "INV-7"
    auto = await create(client, headers, template_id, receipt_data())
    assert auto.json()["receipt_number"] == "R-0001"


async def test_duplicate_override_is_a_clear_409(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template_id = await make_template(client, headers)
    await create(client, headers, template_id, receipt_data(number="INV-7"))

    duplicate = await create(client, headers, template_id, receipt_data(number="INV-7"))
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == {
        "code": "RECEIPT_NUMBER_TAKEN",
        "message": "Receipt number INV-7 is already used. Choose another or leave it blank.",
        "fields": ["receipt.number"],
    }
    # The same number is fine for a different user
    other = await login("other@example.com")
    other_template = await make_template(client, other)
    assert (await create(client, other, other_template, receipt_data(number="INV-7"))).status_code == 201


async def test_auto_numbering_skips_numbers_taken_by_overrides(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template_id = await make_template(client, headers)
    await create(client, headers, template_id, receipt_data(number="R-0001"))

    assert (await client.get("/receipts/next-number", headers=headers)).json()["next_number"] == "R-0002"
    auto = await create(client, headers, template_id, receipt_data())
    assert auto.json()["receipt_number"] == "R-0002"


async def test_nanoid_mode(
    client: AsyncClient, login: Login, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    headers = await login("owner@example.com")
    async with session_factory() as session:
        await session.execute(update(User).values(numbering_mode="nanoid"))
        await session.commit()
    template_id = await make_template(client, headers)

    assert (await client.get("/receipts/next-number", headers=headers)).json() == {
        "mode": "nanoid", "next_number": None,
    }
    numbers = {
        (await create(client, headers, template_id, receipt_data())).json()["receipt_number"]
        for _ in range(3)
    }
    assert len(numbers) == 3
    assert all(re.fullmatch(r"[0-9A-Z]{10}", n) for n in numbers)


async def test_missing_variable_values_are_422_with_field_names(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template_id = await make_template(client, headers)

    response = await create(client, headers, template_id, receipt_data(customer={"name": "  "}, custom={}))
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "MISSING_VARIABLES"
    assert response.json()["detail"]["fields"] == ["customer.name", "custom.table_no"]
    # ...and nothing was consumed: receipt.notes is optional, so this one succeeds as R-0001
    ok = await create(client, headers, template_id, receipt_data())
    assert ok.json()["receipt_number"] == "R-0001"


async def test_totals_are_computed_server_side(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template_id = await make_template(client, headers)

    items = [
        {"description": "Latte", "qty": "2", "unit_price": "4.50", "line_total": "999.99"},
        {"description": "Bagel", "qty": "1", "unit_price": "3.25"},
    ]
    response = await create(client, headers, template_id, receipt_data(items=items, discount="1.25"))
    assert response.status_code == 201, response.text
    body = response.json()
    # Client-sent line totals are ignored
    assert [i["line_total"] for i in body["data"]["items"]] == ["9.00", "3.25"]
    assert body["data"]["computed"] == {"subtotal": "12.25", "tax": "0.88", "discount": "1.25", "total": "11.88"}
    assert body["total_amount"] == "11.88"
    assert body["currency"] == "USD"
    assert body["data"]["receipt"]["number"] == "R-0001"


async def test_discount_larger_than_subtotal(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template_id = await make_template(client, headers)
    response = await create(client, headers, template_id, receipt_data(discount="100.00"))
    assert response.status_code == 422
    assert response.json()["detail"]["fields"] == ["discount"]


async def test_bad_money_and_items_are_rejected(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template_id = await make_template(client, headers)
    bad_items = [
        [{"description": "X", "qty": "0", "unit_price": "1.00"}],      # qty must be > 0
        [{"description": "X", "qty": "1", "unit_price": "-1.00"}],     # no negative prices
        [{"description": "X", "qty": "1", "unit_price": "1.005"}],     # cents only
        [{"description": "", "qty": "1", "unit_price": "1.00"}],       # description required
    ]
    for items in bad_items:
        assert (await create(client, headers, template_id, receipt_data(items=items))).status_code == 422
    assert (await create(client, headers, template_id, receipt_data(tax_rate="1.5"))).status_code == 422


async def test_snapshot_is_kept_when_the_template_changes(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template_id = await make_template(client, headers)
    receipt = (await create(client, headers, template_id, receipt_data())).json()

    await client.put(f"/templates/{template_id}", headers=headers, json={"canvas": canvas(text("t", "New"))})
    stored = (await client.get(f"/receipts/{receipt['id']}", headers=headers)).json()
    assert len(stored["template_snapshot"]["elements"]) == 3

    listing = (await client.get("/receipts", headers=headers)).json()
    assert [r["receipt_number"] for r in listing] == ["R-0001"]


async def test_receipts_and_templates_are_private(client: AsyncClient, login: Login) -> None:
    owner = await login("owner@example.com")
    other = await login("other@example.com")
    template_id = await make_template(client, owner)
    receipt = (await create(client, owner, template_id, receipt_data())).json()

    assert (await create(client, other, template_id, receipt_data())).status_code == 404
    assert (await client.get(f"/receipts/{receipt['id']}", headers=other)).status_code == 404
    assert (await client.get("/receipts", headers=other)).json() == []
