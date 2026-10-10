"""How much text a QR code can hold.

Largest QR code (version 40), byte mode, per error-correction level. Text is
measured in UTF-8 bytes: plain English characters are 1 byte, accented and
non-Latin ones 2-3. Both segno (the PDF) and qrcode.react (the editor) fail
above these limits; mirrored by QR_BYTE_CAPACITY in frontend/src/lib/units.ts.
"""
from collections.abc import Iterable, Mapping
from typing import Any, Literal

from app.services import variables_service

ErrorCorrection = Literal["L", "M", "Q", "H"]

QR_BYTE_CAPACITY: dict[str, int] = {"L": 2953, "M": 2331, "Q": 1663, "H": 1273}


class QrContentTooLongError(ValueError):
    """A QR code's filled-in content is more than it can hold."""

    def __init__(self, level: str, fields: list[str]) -> None:
        super().__init__(too_long_message(level))
        self.level = level
        self.fields = fields  # the variables that QR code uses


def byte_length(text: str) -> int:
    return len(text.encode("utf-8"))


def fits(content: str, level: str) -> bool:
    return byte_length(content) <= QR_BYTE_CAPACITY[level]


def too_long_message(level: str) -> str:
    return (
        f"Too much text for a QR code: at most {QR_BYTE_CAPACITY[level]} characters at "
        f"error correction {level} (accented and non-Latin characters count as 2-3)."
    )


def check_codes(elements: Iterable[Mapping[str, Any]], values: Mapping[str, str]) -> None:
    """Raises QrContentTooLongError for the first QR code whose resolved content doesn't fit."""
    for element in elements:
        if element.get("type") != "qr":
            continue
        props = element.get("props", {})
        content, level = str(props.get("content", "")), str(props.get("errorCorrection", "M"))
        if not fits(variables_service.resolve(content, values), level):
            used = list(dict.fromkeys(variables_service.find_variables(content)))
            raise QrContentTooLongError(level, used)
