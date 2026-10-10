"""Receipt rendering: HTML (Jinja2 receipt.html.j2) -> PDF (WeasyPrint) -> PNG (PyMuPDF).

Parity rule: the HTML mirrors the React element components exactly (absolute
positioning only, explicit sizes, overflow hidden, the same fonts). Element
inner layouts mirror frontend/src/lib/elementLayout.ts; the push-down layout is
layout_service (shared fixtures). Change both sides together.

Security: user text is substituted with the whitelist regex
(variables_service.resolve) and handed to a SandboxedEnvironment with autoescape
on, as data only; templates never come from users. Rendering may only read the
bundled fonts and inline data: images.

WeasyPrint and PyMuPDF are synchronous and CPU-bound: the async endpoints call
render_pdf_async / pdf_to_png_async, which run them on one worker thread so the
event loop keeps serving other requests (and renders queue up rather than
competing for the CPU).
"""
import asyncio
import base64
import json
import math
import os
import urllib.request
import uuid
from collections.abc import Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import pymupdf
import segno
from jinja2 import FileSystemLoader, StrictUndefined
from jinja2.sandbox import SandboxedEnvironment
from markupsafe import Markup
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.services import asset_service, layout_service, qr_service, variables_service

APP_DIR = Path(__file__).resolve().parents[1]
TEMPLATES_DIR = APP_DIR / "templates_html"
FONTS_DIR = APP_DIR / "fonts"
# Where WeasyPrint's GTK/Pango DLLs live with the standard MSYS2 install
DEFAULT_WINDOWS_DLL_DIR = r"C:\msys64\mingw64\bin"

PNG_SCALE = 2  # PNG pixels per CSS px (2x = 192 dpi)
# PyMuPDF works in PDF points (72 per inch); CSS px are 96 per inch
PX_PER_POINT = 96 / 72
MIN_ELEMENT_SIZE = 8
DIVIDER_PX = 1
ROW_DIVIDER_ALPHA = 0.25
FONT_FALLBACKS = {"Merriweather": "serif", "Roboto Mono": "monospace"}

# --- mirrors frontend/src/lib/elementLayout.ts ---------------------------------
TOTALS_LINE_HEIGHT = 1.4
TOTALS_ROW_GAP = 4
TOTALS_EMPHASIS_SCALE = 1.2
TOTALS_COLOR = "#000000"
TOTALS_LABELS = {
    "subtotal": "Subtotal", "discount": "Discount", "taxable": "Taxable value", "tax": "Tax", "total": "Total",
}
# A plain receipt's single tax line; GST invoices pass their own (CGST + SGST, or IGST)
DEFAULT_TAX_ROWS: tuple[tuple[str, str], ...] = (("tax", "Tax"),)
SIGNATURE_LABEL_FONT_SIZE = 12
SIGNATURE_LABEL_HEIGHT = 16
SIGNATURE_LINE_THICKNESS = 2
SIGNATURE_LABEL_GAP = 4
SIGNATURE_LABEL_FONT = "Inter"


# Raised by build_html for fixed pages that can't hold the content
ContentOverflowError = layout_service.ContentOverflowError


class RendererUnavailableError(Exception):
    """WeasyPrint's system libraries (GTK / Pango) aren't installed."""


@dataclass(frozen=True)
class ReceiptContent:
    values: Mapping[str, str]          # variable key -> resolved value
    rows: Sequence[Mapping[str, str]]  # line items, keyed like the table columns
    totals: Mapping[str, str]          # subtotal, discount, taxable, tax, total (+ cgst, sgst, igst)
    # What the totals' "tax" line prints as: (totals key, label) rows
    tax_rows: Sequence[tuple[str, str]] = DEFAULT_TAX_ROWS


_env = SandboxedEnvironment(
    loader=FileSystemLoader(TEMPLATES_DIR), autoescape=True, undefined=StrictUndefined
)


def font_stack(family: str) -> str:
    return f'"{family}", {FONT_FALLBACKS.get(family, "sans-serif")}'


def css_number(value: float) -> str:
    """12.0 -> '12', 15.5 -> '15.5' (keeps the HTML readable)."""
    rounded = round(float(value), 4)
    return str(int(rounded)) if rounded.is_integer() else str(rounded)


def with_alpha(hex_color: str, alpha: float) -> str:
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    return f"rgba({r}, {g}, {b}, {alpha})"


@lru_cache(maxsize=1)
def font_faces() -> tuple[dict[str, Any], ...]:
    manifest: list[dict[str, Any]] = json.loads((FONTS_DIR / "fonts.json").read_text(encoding="utf-8"))
    return tuple({**f, "src": (FONTS_DIR / f["file"]).as_uri()} for f in manifest)


def _qr_svg(content: str, level: str) -> Markup:
    svg = segno.make(content or " ", error=level.lower(), micro=False).svg_inline(
        border=0, omitsize=True, dark="#000000", light="#ffffff"
    )
    # Fill the box and keep the code square and centred, like qrcode.react
    return Markup(svg.replace("<svg ", '<svg width="100%" height="100%" ', 1))


def _table_model(element: Mapping[str, Any], rows: Sequence[Mapping[str, str]]) -> dict[str, Any]:
    props = element["props"]
    padding = props["rowPadding"]
    divider = props["rowDivider"]
    header_divider = f"{DIVIDER_PX}px solid {props['color']}" if divider else "none"
    row_divider = f"{DIVIDER_PX}px dashed {with_alpha(props['color'], ROW_DIVIDER_ALPHA)}" if divider else "none"
    columns = props["columns"]
    body = []
    for index, row in enumerate(rows):
        has_divider = divider and index < len(rows) - 1
        body.append({
            "cells": [{"text": row.get(c["key"]) or "-", "align": c["align"]} for c in columns],
            "divider": row_divider if has_divider else "none",
            "padding_bottom": css_number(max(0, padding - (DIVIDER_PX if has_divider else 0))),
        })
    return {
        "font": font_stack(props["fontFamily"]),
        "font_size": css_number(props["fontSize"]),
        "color": props["color"],
        "row_height": css_number(layout_service.table_row_height(props["fontSize"], props["lineHeight"], padding)),
        "line_box": math.ceil(props["fontSize"] * props["lineHeight"]),
        "padding": css_number(padding),
        "header_divider": header_divider,
        "header_padding_bottom": css_number(max(0, padding - (DIVIDER_PX if divider else 0))),
        "header_weight": "bold" if props["headerBold"] else "normal",
        "columns": [
            {"label": c["label"], "align": c["align"], "width_pct": css_number(c["width"] * 100)}
            for c in columns
        ],
        "rows": body,
    }


def _totals_lines(show: Sequence[str], tax_rows: Sequence[tuple[str, str]]) -> list[tuple[str, str, str]]:
    """(line, totals key, label) per printed row: "tax" becomes its tax rows."""
    lines: list[tuple[str, str, str]] = []
    for line in show:
        if line == "tax":
            lines += [(line, key, label) for key, label in tax_rows]
        else:
            lines.append((line, line, TOTALS_LABELS[line]))
    return lines


def _totals_model(
    element: Mapping[str, Any], totals: Mapping[str, str], tax_rows: Sequence[tuple[str, str]]
) -> dict[str, Any]:
    props = element["props"]
    rows, top = [], 0
    for line, key, label in _totals_lines(props["show"], tax_rows):
        emphasized = line == "total" and props["emphasizeTotal"]
        font_size = props["fontSize"] * TOTALS_EMPHASIS_SCALE if emphasized else props["fontSize"]
        height = math.ceil(font_size * TOTALS_LINE_HEIGHT)
        rows.append({
            "line": key,
            "top": top,
            "height": height,
            "font_size": css_number(font_size),
            "weight": 700 if emphasized else 400,
            "label": label,
            "value": f"{props['currencySymbol']}{totals.get(key, '')}",
        })
        top += height + TOTALS_ROW_GAP
    return {"font": font_stack(props["fontFamily"]), "color": TOTALS_COLOR, "rows": rows}


def _signature_model(element: Mapping[str, Any], height: float, src: str | None) -> dict[str, Any]:
    props = element["props"]
    label_top = height - SIGNATURE_LABEL_HEIGHT
    line_top = label_top - SIGNATURE_LABEL_GAP - SIGNATURE_LINE_THICKNESS
    return {
        "src": src,
        "image_height": css_number(max(0, line_top)),
        "line_top": css_number(line_top),
        "line_thickness": SIGNATURE_LINE_THICKNESS,
        "label_top": css_number(label_top),
        "label_height": SIGNATURE_LABEL_HEIGHT,
        "label_font_size": SIGNATURE_LABEL_FONT_SIZE,
        "font": font_stack(SIGNATURE_LABEL_FONT),
        "color": props["lineColor"],
        "label": props["label"],
    }


def element_model(
    element: Mapping[str, Any], content: ReceiptContent, assets: Mapping[str, str]
) -> dict[str, Any]:
    """Everything receipt.html.j2 needs for one element, pre-computed."""
    props = element["props"]
    height = max(element["height"], MIN_ELEMENT_SIZE)
    model: dict[str, Any] = {
        "id": element["id"],
        "type": element["type"],
        "x": css_number(element["x"]),
        "y": css_number(element["y"]),
        "width": css_number(element["width"]),
        "height": css_number(height),
    }
    kind = element["type"]
    if kind == "text":
        model.update(
            content=variables_service.resolve(props["content"], content.values),
            font=font_stack(props["fontFamily"]),
            font_size=css_number(props["fontSize"]),
            font_weight=props["fontWeight"],
            color=props["color"],
            align=props["align"],
            line_height=css_number(props["lineHeight"]),
        )
    elif kind == "image":
        model.update(src=assets.get(props.get("assetId") or ""), fit=props["fit"])
    elif kind == "items_table":
        model.update(_table_model(element, content.rows))
    elif kind == "totals":
        model.update(_totals_model(element, content.totals, content.tax_rows))
    elif kind == "qr":
        model.update(svg=_qr_svg(variables_service.resolve(props["content"], content.values), props["errorCorrection"]))
    elif kind == "signature":
        model.update(_signature_model(element, height, assets.get(props.get("assetId") or "")))
    elif kind == "divider":
        model.update(
            line_top=css_number((height - props["thickness"]) / 2),
            thickness=css_number(props["thickness"]),
            style=props["style"],
            color=props["color"],
        )
    return model


# Mirrors BrandStrip in frontend/src/components/preview/ReceiptPreview.tsx
BRAND = {"text": "Made with Receipt Studio", "font_size": 8, "color": "#9CA3AF"}


def build_html(
    canvas: Mapping[str, Any], content: ReceiptContent, assets: Mapping[str, str]
) -> tuple[str, layout_service.LayoutResult]:
    """The receipt page as HTML, laid out for len(content.rows) line items."""
    page = canvas["page"]
    layout = layout_service.apply_layout(page, canvas["elements"], len(content.rows))
    if layout.error == layout_service.CONTENT_OVERFLOW:
        raise ContentOverflowError(str(page.get("preset", "")))
    # segno can't encode more than a QR code holds (QrContentTooLongError)
    qr_service.check_codes(canvas["elements"], content.values)
    # Auto-height pages grow to fit the brand strip; fixed pages hold it in the margin
    strip = layout_service.BRAND_STRIP_HEIGHT
    page_height = layout.page_height + (strip if page["heightMode"] == "auto" else 0)
    html = _env.get_template("receipt.html.j2").render(
        page=page,
        page_height=css_number(page_height),
        brand={"top": css_number(page_height - strip), "height": strip, **BRAND},
        fonts=font_faces(),
        elements=[element_model(e, content, assets) for e in layout.elements],
    )
    return html, layout


async def asset_sources(db: AsyncSession, user: User, canvas: Mapping[str, Any]) -> dict[str, str]:
    """assetId -> data: URI for the user's own images used by the canvas."""
    sources: dict[str, str] = {}
    for element in canvas["elements"]:
        asset_id = element.get("props", {}).get("assetId") if element["type"] in ("image", "signature") else None
        if not asset_id or asset_id in sources:
            continue
        try:
            asset = await asset_service.get_user_asset(db, user, uuid.UUID(asset_id))
        except ValueError:
            continue
        path = asset_service.asset_file_path(asset) if asset else None
        if asset and path:
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            sources[asset_id] = f"data:{asset.mime_type};base64,{encoded}"
    return sources


def _load_weasyprint() -> Any:
    # WeasyPrint finds GTK/Pango through this variable on Windows; it has to be
    # set before the first import
    if os.name == "nt" and "WEASYPRINT_DLL_DIRECTORIES" not in os.environ:
        configured = settings.WEASYPRINT_DLL_DIRECTORIES
        if not configured and Path(DEFAULT_WINDOWS_DLL_DIR).is_dir():
            configured = DEFAULT_WINDOWS_DLL_DIR
        if configured:
            os.environ["WEASYPRINT_DLL_DIRECTORIES"] = configured
    try:
        import weasyprint
    except (ImportError, OSError) as e:
        raise RendererUnavailableError(str(e)) from e
    return weasyprint


def render_pdf(html: str) -> bytes:
    weasyprint = _load_weasyprint()

    fetcher_base: Any = weasyprint.URLFetcher

    class LocalOnlyFetcher(fetcher_base):  # type: ignore[misc]
        """Bundled fonts and inline data: images only; nothing from the network."""

        def fetch(self, url: str, headers: Any = None) -> Any:
            if url.startswith("file:"):
                path = Path(urllib.request.url2pathname(urlparse(url).path)).resolve()
                if not path.is_relative_to(FONTS_DIR.resolve()):
                    raise ValueError(f"Blocked file outside the fonts folder: {url}")
            return super().fetch(url, headers)

    fetcher = LocalOnlyFetcher(allowed_protocols={"file", "data"})
    pdf: bytes = weasyprint.HTML(string=html, base_url=str(TEMPLATES_DIR), url_fetcher=fetcher).write_pdf()
    return pdf


def pdf_to_png(pdf: bytes, scale: float = PNG_SCALE) -> bytes:
    with pymupdf.open(stream=pdf, filetype="pdf") as document:  # type: ignore[no-untyped-call]
        zoom = scale * PX_PER_POINT
        matrix = pymupdf.Matrix(zoom, zoom)  # type: ignore[no-untyped-call]
        pixmap = document[0].get_pixmap(matrix=matrix, alpha=False)
        png: bytes = pixmap.tobytes("png")
    return png


_render_thread = ThreadPoolExecutor(max_workers=1, thread_name_prefix="render")


async def render_pdf_async(html: str) -> bytes:
    return await asyncio.get_running_loop().run_in_executor(_render_thread, render_pdf, html)


async def pdf_to_png_async(pdf: bytes) -> bytes:
    return await asyncio.get_running_loop().run_in_executor(_render_thread, pdf_to_png, pdf)
