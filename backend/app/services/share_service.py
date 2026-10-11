"""Private links to a receipt's PDF, for sending to the customer (WhatsApp).

A link carries a signed token naming the receipt, so anyone holding it can
open that one PDF without signing in, and nothing else. Tokens are short, to
keep WhatsApp messages readable: the receipt's id plus an HMAC-SHA256
signature (96 bits) made with SECRET_KEY, both base64url, 38 characters.
Changing SECRET_KEY stops every link working. Links sent before this format
(JWTs, which contain dots) are still accepted.
"""
import base64
import binascii
import hashlib
import hmac
import uuid

from jose import JWTError, jwt

from app.core.config import settings

PURPOSE = "receipt_link"
SIGNATURE_BYTES = 12


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _signature(receipt_id: uuid.UUID) -> bytes:
    message = PURPOSE.encode() + receipt_id.bytes
    return hmac.new(settings.SECRET_KEY.encode(), message, hashlib.sha256).digest()[:SIGNATURE_BYTES]


def make_token(receipt_id: uuid.UUID) -> str:
    return _b64(receipt_id.bytes) + _b64(_signature(receipt_id))


def _legacy_receipt_id(token: str) -> uuid.UUID | None:
    try:
        claims = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    # A login token is signed with the same key: only receipt links count
    if claims.get("purpose") != PURPOSE or not isinstance(claims.get("rid"), str):
        return None
    try:
        return uuid.UUID(claims["rid"])
    except ValueError:
        return None


def receipt_id_from(token: str) -> uuid.UUID | None:
    """The receipt a token names, or None if it isn't one of ours."""
    if "." in token:
        return _legacy_receipt_id(token)
    if len(token) != 38:  # 22 characters of id + 16 of signature
        return None
    try:
        receipt_id = uuid.UUID(bytes=_unb64(token[:22]))
        signature = _unb64(token[22:])
    except (ValueError, binascii.Error):
        return None
    return receipt_id if hmac.compare_digest(signature, _signature(receipt_id)) else None
