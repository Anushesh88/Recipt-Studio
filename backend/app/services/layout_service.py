"""The shared Layout Algorithm (docs/03-schema.md), computed before rendering
(Architecture rule 10). Same steps as frontend/src/lib/layout.ts; both must pass
shared/fixtures/layout_cases.json.

    row_h      = ceil(fontSize * lineHeight) + 2 * rowPadding   (header_h == row_h)
    actual_h   = header_h + n_rows * row_h
    delta      = actual_h - designed_h        (fixed pages: max(0, delta))
    every element whose top is at/below the table's designed bottom moves by delta
    the table becomes designed_h + delta tall
    auto pages: page height += delta; fixed pages: anything past the bottom
    margin is CONTENT_OVERFLOW
"""
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

CONTENT_OVERFLOW = "CONTENT_OVERFLOW"


class ContentOverflowError(Exception):
    """A fixed-size page can't hold the content."""

    def __init__(self, preset: str) -> None:
        super().__init__(preset)
        self.preset = preset


def ensure_fits(page: Mapping[str, Any], elements: Sequence[Mapping[str, Any]], n_rows: int) -> None:
    if apply_layout(page, elements, n_rows).error == CONTENT_OVERFLOW:
        raise ContentOverflowError(str(page.get("preset", "")))


def table_row_height(font_size: float, line_height: float, row_padding: float) -> float:
    return math.ceil(font_size * line_height) + 2 * row_padding


def table_height(props: Mapping[str, Any], rows: int) -> float:
    return (1 + rows) * table_row_height(props["fontSize"], props["lineHeight"], props["rowPadding"])


@dataclass
class LayoutResult:
    # Copies of the input elements with y / height adjusted for the row count
    elements: list[dict[str, Any]]
    page_height: float
    delta: float
    error: str | None = None
    positions: dict[str, tuple[float, float]] = field(default_factory=dict)


def apply_layout(
    page: Mapping[str, Any], elements: Sequence[Mapping[str, Any]], n_rows: int
) -> LayoutResult:
    fixed = page["heightMode"] == "fixed"
    table = next((e for e in elements if e["type"] == "items_table"), None)

    delta: float = 0
    positioned = [dict(e) for e in elements]
    if table is not None:
        designed = table["height"]
        delta = table_height(table["props"], n_rows) - designed
        if fixed:
            delta = max(0, delta)
        table_bottom = table["y"] + designed
        for original, element in zip(elements, positioned, strict=True):
            if original is table:
                element["height"] = designed + delta
            elif original["y"] >= table_bottom:
                element["y"] = original["y"] + delta

    overflow = fixed and any(
        e["y"] + e["height"] > page["height"] - page["margin"] for e in positioned
    )
    return LayoutResult(
        elements=positioned,
        page_height=page["height"] if fixed else page["height"] + delta,
        delta=delta,
        error=CONTENT_OVERFLOW if overflow else None,
        positions={e["id"]: (e["y"], e["height"]) for e in positioned},
    )
