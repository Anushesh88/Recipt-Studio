"""Runs shared/fixtures (also run by the frontend) against the backend services."""
import json
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from app.services import totals_service, variables_service

FIXTURES = Path(__file__).resolve().parents[2] / "shared" / "fixtures"


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
            with pytest.raises(totals_service.DiscountTooLargeError):
                totals_service.compute_totals(items, tax_rate, discount)
            continue
        result = totals_service.compute_totals(items, tax_rate, discount)
        expected = case["expected"]
        assert [str(t) for t in result.line_totals] == expected["line_totals"], case["name"]
        assert str(result.subtotal) == expected["subtotal"], case["name"]
        assert str(result.discount) == expected["discount"], case["name"]
        assert str(result.tax) == expected["tax"], case["name"]
        assert str(result.total) == expected["total"], case["name"]
