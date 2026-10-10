"""Runs shared/fixtures (also run by the frontend) against the backend services."""
import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from app.services import gst_service, layout_service, totals_service, variables_service

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


def test_gstin_checks() -> None:
    for case in load("gst_cases.json")["gstin"]:
        assert gst_service.gstin_problem(case["gstin"]) == case["problem"], case["gstin"]


def test_gst_totals() -> None:
    for case in load("gst_cases.json")["totals"]:
        lines = [
            gst_service.GstLineInput(
                Decimal(line["qty"]), Decimal(line["unit_price"]), Decimal(line["discount"]), Decimal(line["gst_rate"])
            )
            for line in case["lines"]
        ]
        if "error" in case:
            assert case["error"] == "LINE_DISCOUNT_TOO_LARGE"
            with pytest.raises(gst_service.LineDiscountTooLargeError):
                gst_service.compute_totals(lines, case["supplier_state"], case["place_of_supply"])
            continue
        result = gst_service.compute_totals(lines, case["supplier_state"], case["place_of_supply"])
        expected = case["expected"]
        assert (result.supply, result.state_tax_label) == (expected["supply"], expected["state_tax_label"]), case["name"]
        assert [
            {"amount": str(line.amount), "taxable_value": str(line.taxable_value),
             "cgst": str(line.cgst), "sgst": str(line.sgst), "igst": str(line.igst)}
            for line in result.lines
        ] == expected["lines"], case["name"]
        for key in ("subtotal", "discount", "taxable", "cgst", "sgst", "igst", "total"):
            assert str(getattr(result, key)) == expected[key], (case["name"], key)


def test_financial_years_and_invoice_numbers() -> None:
    cases = load("gst_cases.json")
    for case in cases["financial_year"]:
        start = gst_service.financial_year(date.fromisoformat(case["date"]))
        assert start == case["start_year"], case["date"]
        assert gst_service.financial_year_label(start) == case["label"], case["date"]
    for case in cases["invoice_numbers"]:
        number = gst_service.format_invoice_number(case["prefix"], case["start_year"], case["seq"])
        assert number == case["number"]


def test_gst_invoice_particulars() -> None:
    for case in load("gst_cases.json")["particulars"]:
        assert gst_service.missing_particulars(case["elements"]) == case["missing"], case["name"]
