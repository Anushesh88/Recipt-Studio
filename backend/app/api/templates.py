from fastapi import APIRouter, Depends

from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/")
async def get_templates(current_user: User = Depends(get_current_user)) -> list[dict[str, str]]:
    return []
