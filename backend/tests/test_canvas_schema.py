import pytest
from pydantic import ValidationError

from app.schemas.canvas import (
    Canvas,
    ItemsTableElement,
    ItemsTableProps,
    PageConfig,
    TextElement,
    TextProps,
)


def get_valid_page():
    return PageConfig(preset="thermal80", width=302, height=640, heightMode="auto", background="#FFFFFF", margin=12)

def get_valid_text():
    return TextElement(
        id="el_1", type="text", x=10, y=10, width=100, height=20,
        props=TextProps(
            content="Hello {{customer.name}}", fontFamily="Inter", fontSize=12, color="#000000"
        )
    )

def get_valid_items_table(id_suffix="1"):
    return ItemsTableElement(
        id=f"table_{id_suffix}", type="items_table", x=10, y=50, width=280, height=100,
        props=ItemsTableProps(
            binding="receipt.items",
            columns=[{"key": "desc", "label": "Desc", "width": 1.0, "align": "left"}],
            fontFamily="Inter", fontSize=12, color="#000000"
        )
    )

def test_valid_canvas():
    canvas = Canvas(page=get_valid_page(), elements=[get_valid_text(), get_valid_items_table()])
    assert len(canvas.elements) == 2

def test_unknown_variable():
    with pytest.raises(ValidationError) as exc:
        TextElement(
            id="el_1", type="text", x=10, y=10, width=100, height=20,
            props=TextProps(
                content="Hello {{unknown.var}}", fontFamily="Inter", fontSize=12, color="#000000"
            )
        )
    assert "Unknown variable: unknown.var" in str(exc.value)

def test_second_items_table():
    with pytest.raises(ValidationError) as exc:
        Canvas(page=get_valid_page(), elements=[get_valid_items_table("1"), get_valid_items_table("2")])
    assert "Max one items_table element is allowed" in str(exc.value)

def test_unknown_element_type():
    with pytest.raises(ValidationError):
        Canvas(page=get_valid_page(), elements=[{
            "id": "el_1", "type": "unknown_type", "x": 10, "y": 10, "width": 100, "height": 20, "props": {}
        }])

def test_out_of_range_values():
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
