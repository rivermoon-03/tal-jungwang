from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.subway import SubwayNextResponse, SubwayTimetableResponse
from app.services.subway import get_next, get_timetable
from app.services.subway_realtime import get_all_realtime_cached

KST = ZoneInfo("Asia/Seoul")

router = APIRouter(prefix="/api/v1/subway", tags=["subway"])


@router.get("/timetable")
@limiter.limit("60/minute")
async def subway_timetable(
    request: Request,
    response: Response,
    date_str: str | None = Query(None, alias="date"),
    direction: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        d = date.fromisoformat(date_str) if date_str else datetime.now(KST).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식은 YYYY-MM-DD 이어야 합니다.")
    result = await get_timetable(db, d, direction)
    response.headers["Cache-Control"] = "public, max-age=1800, stale-while-revalidate=43200"
    return ApiResponse[SubwayTimetableResponse].ok(result)


@router.get("/next")
async def subway_next(
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(KST)
    d = now.date()
    t = now.time()
    result = await get_next(db, d, t)
    response.headers["Cache-Control"] = "public, max-age=15, stale-while-revalidate=60"
    return ApiResponse[SubwayNextResponse].ok(result)


@router.get("/realtime")
@limiter.limit("60/minute")
async def subway_realtime(request: Request, response: Response):
    """역별 실시간 도착정보 + graceful degradation 메타.

    각 역마다 {items, stale, last_successful_realtime_at} 형식으로 반환.
    실시간 API가 빈 배열을 주거나 실패해도, 직전 5분 이내 성공값이 있으면
    `stale=true`와 함께 그 값을 돌려준다.
    """
    data = await get_all_realtime_cached()
    response.headers["Cache-Control"] = "public, max-age=10, stale-while-revalidate=30"
    return ApiResponse[dict].ok(data)
