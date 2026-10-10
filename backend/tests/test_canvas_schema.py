import pytest
from pydantic import ValidationError

from app.schemas.canvas import (
    MAX_CANVAS_BYTES,
    Canvas,
    FontFamily,
    ItemsTableElement,
    ItemsTableProps,
    PageConfig,
    TextElement,
    TextProps,
)


def get_valid_page() -> PageConfig:
    return PageConfig(preset="thermal80", width=302, height=640, heightMode="auto", background="#FFFFFF", margin=12)

def get_valid_text() -> TextElement:
    return TextElement(
        id="el_1", type="text", x=10, y=10, width=100, height=20,
        props=TextProps(
            content="Hello {{customer.name}}", fontFamily="Inter", fontSize=12, color="#000000"
        )
    )

def get_valid_items_table(id_suffix: str = "1") -> ItemsTableElement:
    return ItemsTableElement(
        id=f"table_{id_suffix}", type="items_table", x=10, y=50, width=280, height=100,
        props=ItemsTableProps(
            binding="receipt.items",
            columns=[{"key": "description", "label": "Desc", "width": 1.0, "align": "left"}],  # type: ignore
            fontFamily="Inter", fontSize=12, color="#000000"
        )
    )

def test_valid_canvas() -> None:
    canvas = Canvas(page=get_valid_page(), elements=[get_valid_text(), get_valid_items_table()])
    assert len(canvas.elements) == 2

def test_unknown_variable() -> None:
    with pytest.raises(ValidationError) as exc:
        TextElement(
            id="el_1", type="text", x=10, y=10, width=100, height=20,
            props=TextProps(
                content="Hello {{unknown.var}}", fontFamily="Inter", fontSize=12, color="#000000"
            )
        )
    assert "Unknown variable: unknown.var" in str(exc.value)

def test_second_items_table() -> None:
    with pytest.raises(ValidationError) as exc:
        Canvas(page=get_valid_page(), elements=[get_valid_items_table("1"), get_valid_items_table("2")])
    assert "Max one items_table element is allowed" in str(exc.value)

def test_unknown_element_type() -> None:
    with pytest.raises(ValidationError):
        Canvas(page=get_valid_page(), elements=[{
            "id": "el_1", "type": "unknown_type", "x": 10, "y": 10, "width": 100, "height": 20, "props": {}
        }])  # type: ignore

def test_out_of_range_values() -> None:
    with pytest.raises(ValidationError):
        TextElement(
            id="el_1", type="text", x=-10, y=10, width=100, height=20, # x is -10
            props=TextProps(
                content="Hello", fontFamily="Inter", fontSize=12, color="#000000"
            )
        )
    with pytest.raises(ValidationError):
        TextElement(
            id="el_1", type="text", x=10, y=10, width=100, height=20,
            props=TextProps(
                content="Hello", fontFamily="Inter", fontSize=5, color="#000000" # fontSize 5 is < 6
            )
        )

def test_duplicate_element_ids() -> None:
    a = get_valid_text()
    b = get_valid_text()  # same id "el_1"
    with pytest.raises(ValidationError) as exc:
        Canvas(page=get_valid_page(), elements=[a, b])
    assert "Duplicate element ids: el_1" in str(exc.value)

def test_element_must_fit_page_width() -> None:
    wide = get_valid_text()
    wide.x = 250  # 250 + 100 > 302
    with pytest.raises(ValidationError) as exc:
        Canvas(page=get_valid_page(), elements=[wide])
    assert "extends past the page width" in str(exc.value)

def test_page_height_only_bounds_fixed_pages() -> None:
    low = get_valid_text()
    low.y = 700  # below the 640px design height
    # auto-height pages grow, so this is fine
    Canvas(page=get_valid_page(), elements=[low])

    fixed = PageConfig(
        preset="a5", width=559, height=794, heightMode="fixed",
        background="#FFFFFF", margin=24,
    )
    low.y = 780  # 780 + 20 > 794
    with pytest.raises(ValidationError) as exc:
        Canvas(page=fixed, elements=[low])
    assert "extends past the page height" in str(exc.value)

def test_canvas_size_limit() -> None:
    big = get_valid_text()
    big.props.content = "x" * (MAX_CANVAS_BYTES + 1)
    with pytest.raises(ValidationError) as exc:
        Canvas(page=get_valid_page(), elements=[big])
    assert "larger than 256 KB" in str(exc.value)

def test_font_family_must_be_curated() -> None:
    families: list[FontFamily] = ["Inter", "Open Sans", "Merriweather", "Roboto Mono"]
    for family in families:
        TextProps(content="Hi", fontFamily=family, fontSize=12, color="#000000")
    with pytest.raises(ValidationError):
        TextProps(content="Hi", fontFamily="Comic Sans MS", fontSize=12, color="#000000")  # type: ignore[arg-type]


# --- Ranges: anything the editor can't produce is rejected (Architecture rule 2) ---

def _canvas_json(**overrides: object) -> dict[str, object]:
    canvas = Canvas(page=get_valid_page(), elements=[get_valid_text(), get_valid_items_table()])
    data = canvas.model_dump(mode="json")
    data.update(overrides)
    return data


def _with(path: str, value: object) -> dict[str, object]:
    """The valid canvas with one value replaced, e.g. "elements.1.props.rowPadding"."""
    data = _canvas_json()
    node: object = data
    *parents, last = path.split(".")
    for part in parents:
        node = node[int(part)] if isinstance(node, list) else node[part]  # type: ignore[index]
    if isinstance(node, list):
        node[int(last)] = value
    else:
        node[last] = value  # type: ignore[index]
    return data


@pytest.mark.parametrize(("path", "value"), [
    ("elements.0.props.lineHeight", -5),
    ("elements.0.props.lineHeight", 3.5),
    ("elements.0.props.fontWeight", 123456),
    ("elements.0.y", 3001),
    ("elements.0.height", 5000),
    ("elements.0.id", ""),
    ("elements.0.zIndex", -1),
    ("elements.1.props.rowPadding", -40),
    ("elements.1.props.rowPadding", 25),
    ("elements.1.props.columns", []),
    ("elements.1.props.columns.0.width", -3),
    ("elements.1.props.columns.0.label", "x" * 101),
    ("page.height", 10_000_000),
    ("page.height", 199),
    ("page.width", 5000),
    ("page.heightMode", "fixed"),
    ("page.margin", 99999),
])
def test_out_of_range_canvas_values_are_rejected(path: str, value: object) -> None:
    with pytest.raises(ValidationError):
        Canvas.model_validate(_with(path, value))


def test_editor_ranges_are_accepted() -> None:
    for path, value in [
        ("elements.0.props.lineHeight", 0.8), ("elements.0.props.lineHeight", 3),
        ("elements.0.props.fontWeight", 700), ("elements.1.props.rowPadding", 24),
        ("page.height", 200), ("page.height", 3000), ("elements.0.y", 3000),
    ]:
        Canvas.model_validate(_with(path, value))


def test_fixed_presets_have_their_own_size() -> None:
    a4 = {"preset": "a4", "width": 794, "height": 1123, "heightMode": "fixed", "background": "#FFFFFF", "margin": 32}
    Canvas.model_validate({"page": a4, "elements": []})
    with pytest.raises(ValidationError, match="1123px tall"):
        Canvas.model_validate({"page": {**a4, "height": 2000}, "elements": []})


def test_columns_and_totals_lines_are_unique_known_fields() -> None:
    table = _with("elements.1.props.columns", [
        {"key": "qty", "label": "Qty", "width": 0.5, "align": "right"},
        {"key": "qty", "label": "Qty again", "width": 0.5, "align": "right"},
    ])
    with pytest.raises(ValidationError, match="only have one column"):
        Canvas.model_validate(table)
    with pytest.raises(ValidationError):
        Canvas.model_validate(_with("elements.1.props.columns.0.key", "nope"))


def test_infinite_and_nan_numbers_are_rejected() -> None:
    for bad in (float("inf"), float("nan")):
        with pytest.raises(ValidationError):
            Canvas.model_validate(_with("elements.0.y", bad))


def test_asset_ids_are_uuids() -> None:
    image = {"id": "logo", "type": "image", "x": 0, "y": 0, "width": 100, "height": 40,
             "props": {"source": "logo", "assetId": "not-a-uuid", "fit": "contain"}}
    with pytest.raises(ValidationError):
        Canvas.model_validate({"page": get_valid_page().model_dump(), "elements": [image]})


@pytest.mark.parametrize(("level", "capacity"), [("L", 2953), ("M", 2331), ("Q", 1663), ("H", 1273)])
def test_qr_content_must_fit_a_qr_code(level: str, capacity: int) -> None:
    def qr(content: str) -> dict[str, object]:
        return {"id": "qr", "type": "qr", "x": 0, "y": 0, "width": 100, "height": 100,
                "props": {"content": content, "errorCorrection": level}}
    page = get_valid_page().model_dump()
    Canvas.model_validate({"page": page, "elements": [qr("x" * capacity)]})
    with pytest.raises(ValidationError, match="Too much text for a QR code"):
        Canvas.model_validate({"page": page, "elements": [qr("x" * (capacity + 1))]})
    # measured in UTF-8 bytes: the rupee sign is 3
    with pytest.raises(ValidationError, match="Too much text for a QR code"):
        Canvas.model_validate({"page": page, "elements": [qr("₹" * (capacity // 3 + 1))]})
