import pytest
from pydantic import ValidationError

from app.schemas.canvas import (
    MAX_CANVAS_BYTES,
    Canvas,
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
            columns=[{"key": "desc", "label": "Desc", "width": 1.0, "align": "left"}],  # type: ignore
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
