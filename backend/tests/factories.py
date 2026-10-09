"""Canvas payloads for API tests."""
from typing import Any

PAGE: dict[str, Any] = {
    "preset": "thermal80", "width": 302, "height": 400,
    "heightMode": "auto", "background": "#FFFFFF", "margin": 12,
}


def text(element_id: str, content: str, y: int = 12) -> dict[str, Any]:
    return {
        "id": element_id, "type": "text", "x": 12, "y": y, "width": 278, "height": 32,
        "zIndex": 1, "locked": False,
        "props": {
            "content": content, "fontFamily": "Inter", "fontSize": 14, "fontWeight": 400,
            "color": "#111111", "align": "left", "lineHeight": 1.3,
        },
    }


def items_table(element_id: str = "table", y: int = 60) -> dict[str, Any]:
    return {
        "id": element_id, "type": "items_table", "x": 12, "y": y, "width": 278, "height": 96,
        "zIndex": 2, "locked": False,
        "props": {
            "binding": "receipt.items",
            "columns": [
                {"key": "description", "label": "Item", "width": 0.6, "align": "left"},
                {"key": "line_total", "label": "Total", "width": 0.4, "align": "right"},
            ],
            "fontFamily": "Inter", "fontSize": 12, "lineHeight": 1.3, "rowPadding": 4,
            "headerBold": True, "rowDivider": True, "color": "#111111",
        },
    }


def totals(y: int = 170) -> dict[str, Any]:
    return {
        "id": "totals", "type": "totals", "x": 120, "y": y, "width": 170, "height": 90,
        "zIndex": 3, "locked": False,
        "props": {
            "binding": "receipt.totals", "show": ["subtotal", "tax", "discount", "total"],
            "fontFamily": "Inter", "fontSize": 13, "emphasizeTotal": True, "currencySymbol": "$",
        },
    }


def canvas(*elements: dict[str, Any]) -> dict[str, Any]:
    return {"schemaVersion": 1, "page": PAGE, "elements": list(elements)}
