"""Shared bits for the endpoints that render receipts (exports and previews)."""
from fastapi import Depends, HTTPException, Response, status

from app.api.auth import get_current_user
from app.core.config import settings
from app.core.rate_limit import SlidingWindowLimiter
from app.models.user import User
from app.services.export_service import ExportFile

export_limiter = SlidingWindowLimiter(settings.EXPORT_RATE_LIMIT, settings.EXPORT_RATE_WINDOW_SECONDS)


def api_error(status_code: int, code: str, message: str, fields: list[str] | None = None) -> HTTPException:
    # Same {code, message, fields} shape as the other receipt errors
    return HTTPException(
        status_code=status_code, detail={"code": code, "message": message, "fields": fields or []}
    )


async def rate_limited_user(current_user: User = Depends(get_current_user)) -> User:
    """The current user, unless they've rendered too much in the last window."""
    retry_after = export_limiter.hit(str(current_user.id))
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "RATE_LIMITED",
                "message": f"Too many exports. Try again in {retry_after} seconds.",
                "fields": [],
            },
            headers={"Retry-After": str(retry_after)},
        )
    return current_user


def overflow_error(preset: str) -> HTTPException:
    return api_error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "CONTENT_OVERFLOW",
        f"The receipt doesn't fit on one {preset.upper()} page: content runs past the bottom "
        "margin. Remove some line items, move elements up, or use the thermal page size.",
        ["items"],
    )


def renderer_unavailable_error() -> HTTPException:
    return api_error(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "RENDERER_UNAVAILABLE",
        "PDF rendering isn't set up on this server: WeasyPrint's GTK/Pango libraries are missing.",
    )


def file_response(export: ExportFile, *, download: bool = True) -> Response:
    disposition = "attachment" if download else "inline"
    return Response(
        content=export.content,
        media_type=export.media_type,
        headers={
            "Content-Disposition": f'{disposition}; filename="{export.filename}"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
