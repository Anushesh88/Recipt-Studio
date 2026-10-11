import math
from typing import Any, Literal

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.api.assets import router as assets_router
from app.api.auth import router as auth_router
from app.api.catalog import router as catalog_router
from app.api.feedback import router as feedback_router
from app.api.preview import router as preview_router
from app.api.public import router as public_router
from app.api.receipts import router as receipts_router
from app.api.reports import router as reports_router
from app.api.templates import router as templates_router
from app.core.config import settings

if settings.SENTRY_DSN:
    # Error reports only: no request bodies (they hold customers' details), no
    # IP addresses or cookies, no performance tracing
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.APP_ENV,
        send_default_pii=False,
        max_request_body_size="never",
        traces_sample_rate=0,
    )

app = FastAPI(title="Receipt Studio API")

app.add_middleware(
    CORSMiddleware,
    # Sign-in uses a bearer token, not cookies, so no credentials are needed
    allow_origins=[origin.strip().rstrip("/") for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
    # Lets the frontend read the file name of exports
    expose_headers=["Content-Disposition"],
)

def _json_safe(value: Any) -> Any:
    """Infinity / NaN as text. Python's JSON parser accepts them in requests, but
    a response can't contain them, so echoing one back in a 422 would fail."""
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list | tuple):
        return [_json_safe(item) for item in value]
    return value


@app.exception_handler(RequestValidationError)
async def request_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    # FastAPI's default 422 body, made safe to serialize
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": _json_safe(jsonable_encoder(exc.errors()))},
    )


app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(templates_router, prefix="/templates", tags=["templates"])
app.include_router(receipts_router, prefix="/receipts", tags=["receipts"])
app.include_router(assets_router, prefix="/assets", tags=["assets"])
app.include_router(preview_router, prefix="/preview", tags=["preview"])
# Saved customers and items: /customers, /items
app.include_router(catalog_router, tags=["catalog"])
app.include_router(reports_router, prefix="/reports", tags=["reports"])
app.include_router(feedback_router, tags=["feedback"])
app.include_router(public_router, prefix="/public", tags=["public"])

class HealthResponse(BaseModel):
    status: Literal["ok"]


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok")
