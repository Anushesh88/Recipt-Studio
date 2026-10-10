import pytest
from pydantic import ValidationError

from app.core.config import DEV_SECRET_KEY, Settings


def test_development_accepts_the_built_in_key() -> None:
    assert Settings(_env_file=None, APP_ENV="development").SECRET_KEY == DEV_SECRET_KEY  # type: ignore[call-arg]


@pytest.mark.parametrize("key", [DEV_SECRET_KEY, "too-short-for-production"])
def test_production_refuses_a_public_or_short_key(key: str) -> None:
    with pytest.raises(ValidationError, match="Set SECRET_KEY"):
        Settings(_env_file=None, APP_ENV="production", SECRET_KEY=key)  # type: ignore[call-arg]


def test_production_accepts_a_real_key() -> None:
    key = "k" * 48
    assert Settings(_env_file=None, APP_ENV="production", SECRET_KEY=key).SECRET_KEY == key  # type: ignore[call-arg]
