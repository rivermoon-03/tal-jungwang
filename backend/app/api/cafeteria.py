from fastapi import APIRouter, Query, Request, Response

from app.core.limiter import limiter
from app.schemas.cafeteria import CafeteriaMenuResponse
from app.schemas.common import ApiResponse
from app.services.cafeteria import get_menu

router = APIRouter(prefix="/api/v1/cafeteria", tags=["cafeteria"])


@router.get("/menu")
@limiter.limit("60/minute")
async def cafeteria_menu(
    request: Request,
    response: Response,
    refresh: bool = Query(False, description="True면 캐시 무시하고 원본 재다운로드"),
):
    data = await get_menu(force_refresh=refresh)
    if not data:
        return ApiResponse.fail("NO_MENU", "현재 식단표를 가져올 수 없습니다.")
    # refresh=true 강제 갱신 호출은 브라우저/프록시가 캐시 못 하게 한다.
    # 일반 GET은 짧게: 학교가 월요일 오전 늦게 새 식단을 올리는 경우가 있어
    # CDN/브라우저가 stale을 오래 들고 있으면 사용자가 지난주 메뉴를 보게 됨.
    if not refresh:
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=900"
    return ApiResponse[CafeteriaMenuResponse].ok(data)
