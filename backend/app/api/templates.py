from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_templates() -> list[dict[str, str]]:
    return []
