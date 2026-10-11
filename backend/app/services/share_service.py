"""Private links to a receipt's PDF, for sending to the customer (WhatsApp).

A link carries a signed token naming the receipt, so anyone holding it can
open that one PDF without signing in, and nothing else. Tokens are signed
with SECRET_KEY; changing the key stops every link working.
"""
import uuid

from jose import JWTError, jwt

from app.core.config import settings

PURPOSE = "receipt_link"


def make_token(receipt_id: uuid.UUID) -> str:
    return str(jwt.encode({"rid": str(receipt_id), "purpose": PURPOSE}, settings.SECRET_KEY, algorithm=settings.ALGORITHM))


def receipt_id_from(token: str) -> uuid.UUID | None:
    """The receipt a token names, or None if it isn't one of ours."""
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
