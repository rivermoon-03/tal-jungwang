from fastapi import APIRouter, Query, Request

from app.core.limiter import limiter
from app.schemas.cafeteria import CafeteriaMenuResponse
from app.schemas.common import ApiResponse
from app.services.cafeteria import get_menu

router = APIRouter(prefix="/api/v1/cafeteria", tags=["cafeteria"])


@router.get("/menu")
@limiter.limit("60/minute")
async def cafeteria_menu(
    request: Request,
    refresh: bool = Query(False, description="True면 캐시 무시하고 원본 재다운로드"),
):
    data = await get_menu(force_refresh=refresh)
    if not data:
        return ApiResponse.fail("NO_MENU", "현재 식단표를 가져올 수 없습니다.")
    return ApiResponse[CafeteriaMenuResponse].ok(data)
