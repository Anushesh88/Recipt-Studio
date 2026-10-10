"""Runs shared/fixtures (also run by the frontend) against the backend services."""
import json
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from app.services import layout_service, totals_service, variables_service

FIXTURES = Path(__file__).resolve().parents[2] / "shared" / "fixtures"

# Error codes in totals_cases.json -> the exception totals_service raises
TOTALS_ERRORS: dict[str, type[Exception]] = {
    "DISCOUNT_TOO_LARGE": totals_service.DiscountTooLargeError,
    "AMOUNT_TOO_LARGE": totals_service.AmountTooLargeError,
}


def load(name: str) -> dict[str, Any]:
    path = FIXTURES / name
    if not path.exists():  # e.g. inside the backend-only Docker image
        pytest.skip(f"{path} not found")
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return data


def test_variables_find_and_unknown() -> None:
    for case in load("variables_cases.json")["find"]:
        assert variables_service.find_variables(case["text"]) == case["variables"], case["text"]
        assert variables_service.unknown_variables(case["text"]) == case["unknown"], case["text"]


def test_variables_extract() -> None:
    for case in load("variables_cases.json")["extract"]:
        assert variables_service.extract_variables(case["elements"]) == case["variables"], case["name"]


def test_variables_resolve() -> None:
    for case in load("variables_cases.json")["resolve"]:
        assert variables_service.resolve(case["text"], case["values"]) == case["resolved"], case["text"]


def test_totals() -> None:
    for case in load("totals_cases.json")["cases"]:
        items = [
            totals_service.LineInput(qty=Decimal(i["qty"]), unit_price=Decimal(i["unit_price"]))
            for i in case["items"]
        ]
        tax_rate, discount = Decimal(case["tax_rate"]), Decimal(case["discount"])
        if "error" in case:
            with pytest.raises(TOTALS_ERRORS[case["error"]]):
                totals_service.compute_totals(items, tax_rate, discount)
            continue
        result = totals_service.compute_totals(items, tax_rate, discount)
        expected = case["expected"]
        assert [str(t) for t in result.line_totals] == expected["line_totals"], case["name"]
        assert str(result.subtotal) == expected["subtotal"], case["name"]
        assert str(result.discount) == expected["discount"], case["name"]
        assert str(result.tax) == expected["tax"], case["name"]
        assert str(result.total) == expected["total"], case["name"]


def test_layout() -> None:
    fixtures = load("layout_cases.json")
    for case in fixtures["cases"]:
        template = fixtures["templates"][case["template"]]
        result = layout_service.apply_layout(template["page"], template["elements"], case["n_rows"])
        expected = case["expected"]
        assert result.delta == expected["delta"], case["name"]
        assert result.page_height == expected["page_height"], case["name"]
        assert result.error == expected["error"], case["name"]
        assert {
            element_id: {"y": y, "height": height}
            for element_id, (y, height) in result.positions.items()
        } == expected["positions"], case["name"]
