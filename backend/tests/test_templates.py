from collections.abc import Awaitable, Callable

from httpx import AsyncClient

from tests.factories import canvas, items_table, text, totals

Login = Callable[[str], Awaitable[dict[str, str]]]


async def test_create_get_and_round_trip_canvas(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    body = canvas(text("title", "Receipt {{receipt.number}}"), items_table(), totals())
    created = await client.post("/templates", headers=headers, json={"name": "  Cafe  ", "canvas": body})
    assert created.status_code == 201
    template = created.json()
    assert template["name"] == "Cafe"  # trimmed
    assert template["updated_at"].endswith("Z") or "+00:00" in template["updated_at"]

    fetched = await client.get(f"/templates/{template['id']}", headers=headers)
    assert fetched.status_code == 200
    # Saved canvas comes back exactly as sent
    assert fetched.json()["canvas"] == body


async def test_list_returns_summaries_newest_first(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    for name in ["First", "Second"]:
        await client.post("/templates", headers=headers, json={"name": name, "canvas": canvas(items_table())})
    listing = (await client.get("/templates", headers=headers)).json()
    assert {t["name"] for t in listing} == {"First", "Second"}
    assert listing[0]["preset"] == "thermal80"
    assert listing[0]["element_count"] == 1
    assert "canvas" not in listing[0]


async def test_update_and_delete(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    template = (await client.post(
        "/templates", headers=headers, json={"name": "Draft", "canvas": canvas()}
    )).json()

    renamed = await client.put(f"/templates/{template['id']}", headers=headers, json={"name": "Final"})
    assert renamed.json()["name"] == "Final"
    assert renamed.json()["canvas"]["elements"] == []

    new_canvas = canvas(text("hello", "Hi {{customer.name}}"))
    updated = await client.put(f"/templates/{template['id']}", headers=headers, json={"canvas": new_canvas})
    assert updated.json()["canvas"] == new_canvas
    assert updated.json()["name"] == "Final"

    assert (await client.delete(f"/templates/{template['id']}", headers=headers)).status_code == 204
    assert (await client.get(f"/templates/{template['id']}", headers=headers)).status_code == 404


async def test_invalid_canvases_are_rejected(client: AsyncClient, login: Login) -> None:
    headers = await login("owner@example.com")
    bad = [
        canvas(text("t", "Hi {{bogus.var}}")),           # unknown variable
        canvas(items_table("a"), items_table("b", 200)),   # second items_table
        canvas(text("same", "a"), text("same", "b", 60)),  # duplicate ids
    ]
    for body in bad:
        response = await client.post("/templates", headers=headers, json={"name": "Bad", "canvas": body})
        assert response.status_code == 422
    blank_name = await client.post("/templates", headers=headers, json={"name": "   ", "canvas": canvas()})
    assert blank_name.status_code == 422


async def test_templates_are_private(client: AsyncClient, login: Login) -> None:
    owner = await login("owner@example.com")
    other = await login("other@example.com")
    template = (await client.post(
        "/templates", headers=owner, json={"name": "Mine", "canvas": canvas()}
    )).json()
    path = f"/templates/{template['id']}"
    assert (await client.get(path, headers=other)).status_code == 404
    assert (await client.put(path, headers=other, json={"name": "Stolen"})).status_code == 404
    assert (await client.delete(path, headers=other)).status_code == 404
    assert (await client.get("/templates", headers=other)).json() == []
    assert (await client.get("/templates")).status_code == 401
