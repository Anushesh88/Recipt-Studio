"""Variable placeholders ({{namespace.key}}) in text and QR content.

Same whitelist regex and built-ins as frontend/src/lib/variables.ts; both are
checked against shared/fixtures/variables_cases.json. User text is never used as
template source: resolve() only substitutes whitelisted keys (Architecture rule 8).
"""
import re
from collections.abc import Iterable, Mapping
from typing import Any

VARIABLE_REGEX = re.compile(r"\{\{\s*([a-z_]+(?:\.[a-z_]+)?)\s*\}\}")

# The business profile from Settings: {{business.phone}} and so on
PROFILE_KEYS = ("phone", "email", "upi_id", "pan", "bank_details", "licence")
PROFILE_VARIABLES = frozenset(f"business.{key}" for key in PROFILE_KEYS)

BUILTIN_VARIABLES = PROFILE_VARIABLES | frozenset({
    "business.name", "business.address", "business.gstin",
    "customer.name", "customer.email", "customer.address", "customer.gstin",
    "receipt.number", "receipt.date", "receipt.payment_method", "receipt.currency",
    "receipt.notes", "receipt.place_of_supply", "receipt.reverse_charge",
})
CUSTOM_PREFIX = "custom."

# Variables a receipt may leave blank, and ones the server fills in itself
# (the number, and the business address / GSTIN from the account's Settings)
OPTIONAL_VARIABLES = frozenset({"receipt.notes"})
SERVER_PROVIDED_VARIABLES = PROFILE_VARIABLES | frozenset({
    "receipt.number", "business.address", "business.gstin", "receipt.reverse_charge",
})

CONTENT_ELEMENT_TYPES = frozenset({"text", "qr"})


def find_variables(text: str) -> list[str]:
    """Every variable key in the text, in order (repeats included)."""
    return VARIABLE_REGEX.findall(text)


def is_known_variable(key: str) -> bool:
    return key in BUILTIN_VARIABLES or key.startswith(CUSTOM_PREFIX)


def unknown_variables(text: str) -> list[str]:
    """Unknown keys, each once, in order of first appearance."""
    return list(dict.fromkeys(k for k in find_variables(text) if not is_known_variable(k)))


def extract_variables(elements: Iterable[Mapping[str, Any]]) -> list[str]:
    """Unique keys used by a template's text / QR content, in order of first use."""
    keys: list[str] = []
    for element in elements:
        if element.get("type") in CONTENT_ELEMENT_TYPES:
            keys.extend(find_variables(str(element.get("props", {}).get("content", ""))))
    return list(dict.fromkeys(keys))


def _blank_profile_line(line: str, values: Mapping[str, str]) -> bool:
    # e.g. "Phone: {{business.phone}}" for a business without a phone number
    keys = find_variables(line)
    return any(k in PROFILE_VARIABLES for k in keys) and not any(values.get(k, "").strip() for k in keys)


def resolve(text: str, values: Mapping[str, str]) -> str:
    """Substitutes whitelisted placeholders; keys without a value become ''.

    A line that uses a business profile detail and has nothing to show (every
    variable on it is empty) is left out, so templates can list details a
    business may not have.
    """
    lines = [line for line in text.split("\n") if not _blank_profile_line(line, values)]
    return VARIABLE_REGEX.sub(lambda m: values.get(m.group(1), ""), "\n".join(lines))


def missing_required(
    used: Iterable[str], values: Mapping[str, str], optional: Iterable[str] = OPTIONAL_VARIABLES
) -> list[str]:
    """Used variables that need a value but have none (blank counts as none)."""
    skip = set(optional) | SERVER_PROVIDED_VARIABLES
    return [key for key in used if key not in skip and not values.get(key, "").strip()]
