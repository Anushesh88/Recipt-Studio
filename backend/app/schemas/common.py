from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, StringConstraints

from app.services import gst_service


def _assume_utc(value: datetime) -> datetime:
    # SQLite hands back naive timestamps (CURRENT_TIMESTAMP is UTC); without a
    # zone, browsers would read them as local time
    return value if value.tzinfo else value.replace(tzinfo=UTC)


UtcDatetime = Annotated[datetime, AfterValidator(_assume_utc)]


def _valid_gstin(value: str) -> str:
    problem = gst_service.gstin_problem(value)
    if problem:
        raise ValueError(problem)
    return value


def _known_state(code: str) -> str:
    if code not in gst_service.STATES:
        raise ValueError(f"{code} isn't a GST state code.")
    return code


# Uppercased and checked (format, state code, check character)
Gstin = Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True), AfterValidator(_valid_gstin)]
# Two-digit GST state code, e.g. "29" (Karnataka)
StateCode = Annotated[str, StringConstraints(strip_whitespace=True), AfterValidator(_known_state)]
# HSN (goods) or SAC (services) code: 4, 6 or 8 digits
HsnCode = Annotated[str, StringConstraints(strip_whitespace=True, pattern=gst_service.HSN_PATTERN.pattern)]
