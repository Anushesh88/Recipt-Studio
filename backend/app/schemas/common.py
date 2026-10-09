from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator


def _assume_utc(value: datetime) -> datetime:
    # SQLite hands back naive timestamps (CURRENT_TIMESTAMP is UTC); without a
    # zone, browsers would read them as local time
    return value if value.tzinfo else value.replace(tzinfo=UTC)


UtcDatetime = Annotated[datetime, AfterValidator(_assume_utc)]
