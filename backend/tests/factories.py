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
    return {"schemaVersion": 1, "documentType": "receipt", "page": PAGE, "elements": list(elements)}


A4: dict[str, Any] = {
    "preset": "a4", "width": 794, "height": 1123,
    "heightMode": "fixed", "background": "#FFFFFF", "margin": 32,
}


def gst_canvas(qr_content: str | None = None) -> dict[str, Any]:
    """An A4 GST tax invoice with every rule 46 particular."""
    def block(element_id: str, content: str, y: int, height: int = 64) -> dict[str, Any]:
        return {**text(element_id, content, y), "width": 730, "x": 32, "height": height}

    table = items_table(y=320)
    table.update(x=32, width=730)
    table["props"]["columns"] = [
        {"key": "description", "label": "Item", "width": 0.34, "align": "left"},
        {"key": "hsn", "label": "HSN/SAC", "width": 0.14, "align": "left"},
        {"key": "qty", "label": "Qty", "width": 0.14, "align": "right"},
        {"key": "gst_rate", "label": "GST", "width": 0.12, "align": "right"},
        {"key": "taxable_value", "label": "Taxable", "width": 0.26, "align": "right"},
    ]
    gst_totals = totals(y=440)
    gst_totals.update(x=560, width=202, height=120)
    gst_totals["props"].update(show=["taxable", "tax", "total"], currencySymbol="₹")
    elements = [
        block("supplier", "{{business.name}}\n{{business.address}}\nGSTIN: {{business.gstin}}", 32, 80),
        block("invoice", "Tax Invoice {{receipt.number}} dated {{receipt.date}}", 120, 32),
        block("buyer", "Bill to: {{customer.name}}\n{{customer.address}}\nGSTIN: {{customer.gstin}}", 160, 80),
        block("supply", "Place of supply: {{receipt.place_of_supply}}  Reverse charge: {{receipt.reverse_charge}}", 248, 32),
        table,
        gst_totals,
        {"id": "sig", "type": "signature", "x": 560, "y": 600, "width": 202, "height": 60, "zIndex": 7,
         "locked": False, "props": {"label": "Authorised signatory", "assetId": None, "lineColor": "#111111"}},
    ]
    if qr_content is not None:
        elements.append({"id": "qr", "type": "qr", "x": 32, "y": 600, "width": 100, "height": 100, "zIndex": 8,
                         "locked": False, "props": {"content": qr_content, "errorCorrection": "M"}})
    return {"schemaVersion": 1, "documentType": "gst_invoice", "page": A4, "elements": elements}
