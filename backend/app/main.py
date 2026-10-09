from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.receipts import router as receipts_router
from app.api.templates import router as templates_router

app = FastAPI(title="Receipt Studio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(templates_router, prefix="/templates", tags=["templates"])
app.include_router(receipts_router, prefix="/receipts", tags=["receipts"])

@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
