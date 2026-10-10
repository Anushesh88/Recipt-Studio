from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.assets import router as assets_router
from app.api.auth import router as auth_router
from app.api.preview import router as preview_router
from app.api.receipts import router as receipts_router
from app.api.templates import router as templates_router

app = FastAPI(title="Receipt Studio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Lets the frontend read the file name of exports
    expose_headers=["Content-Disposition"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(templates_router, prefix="/templates", tags=["templates"])
app.include_router(receipts_router, prefix="/receipts", tags=["receipts"])
app.include_router(assets_router, prefix="/assets", tags=["assets"])
app.include_router(preview_router, prefix="/preview", tags=["preview"])

class HealthResponse(BaseModel):
    status: Literal["ok"]


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok")
