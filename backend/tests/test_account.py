import re
from collections.abc import Awaitable, Callable

from httpx import AsyncClient

from tests.factories import canvas, text

Login = Callable[[str], Awaitable[dict[str, str]]]


async def test_read_and_update_account(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    me = (await client.get("/auth/me", headers=headers)).json()
    assert me["email"] == "owner@example.com"
    assert (me["business_name"], me["receipt_prefix"], me["numbering_mode"]) == (None, "R-", "sequential")

    updated = await client.patch(
        "/auth/me", headers=headers, json={"business_name": "  Acme Cafe ", "receipt_prefix": "INV-"}
    )
    assert updated.status_code == 200
    assert (updated.json()["business_name"], updated.json()["receipt_prefix"]) == ("Acme Cafe", "INV-")
    # Fields not sent are left alone; "" clears the business name
    cleared = await client.patch("/auth/me", headers=headers, json={"business_name": ""})
    assert cleared.json()["business_name"] is None
    assert cleared.json()["receipt_prefix"] == "INV-"


async def test_prefix_and_mode_drive_numbering(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template = await client.post(
        "/templates", headers=headers, json={"name": "T", "canvas": canvas(text("t", "Hi"))}
    )
    template_id = template.json()["id"]

    async def create() -> str:
        response = await client.post(
            "/receipts", headers=headers, json={"template_id": template_id, "data": {"items": []}}
        )
        assert response.status_code == 201, response.text
        return str(response.json()["receipt_number"])

    assert await create() == "R-0001"
    await client.patch("/auth/me", headers=headers, json={"receipt_prefix": "INV/"})
    assert (await client.get("/receipts/next-number", headers=headers)).json()["next_number"] == "INV/0002"
    assert await create() == "INV/0002"  # the sequence carries on under the new prefix

    await client.patch("/auth/me", headers=headers, json={"numbering_mode": "nanoid"})
    assert (await client.get("/receipts/next-number", headers=headers)).json() == {"mode": "nanoid", "next_number": None}
    assert re.fullmatch(r"[0-9A-Z]{10}", await create())

    await client.patch("/auth/me", headers=headers, json={"numbering_mode": "sequential"})
    assert await create() == "INV/0003"


async def test_invalid_settings_are_rejected(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    for body in [
        {"receipt_prefix": "<script>"},
        {"receipt_prefix": "WAY-TOO-LONG-PREFIX"},
        {"numbering_mode": "random"},
        {"business_name": "x" * 121},
    ]:
        assert (await client.patch("/auth/me", headers=headers, json=body)).status_code == 422
    assert (await client.get("/auth/me")).status_code == 401


async def test_settings_are_per_user(client: AsyncClient, login: Login) -> None:
    owner = await login("owner@example.com")
    other = await login("other@example.com")
    await client.patch("/auth/me", headers=owner, json={"receipt_prefix": "OWN-", "business_name": "Owner Co"})
    other_me = (await client.get("/auth/me", headers=other)).json()
    assert (other_me["receipt_prefix"], other_me["business_name"]) == ("R-", None)


async def test_health_has_a_response_model(client: AsyncClient) -> None:
    assert (await client.get("/health")).json() == {"status": "ok"}
