from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.subway import SubwayNextResponse, SubwayTimetableResponse
from app.services.subway import get_crowding_profile, get_next, get_timetable
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


@router.get("/crowding-profile")
@limiter.limit("60/minute")
async def subway_crowding_profile(
    request: Request,
    response: Response,
    station: str = Query("정왕", max_length=20),
    line: str = Query(..., max_length=10),        # 1004|1075|1093 (실시간 API subwayId 체계)
    direction: str = Query(...),                  # up | down
    db: AsyncSession = Depends(get_db),
):
    """시간대별 혼잡 프로파일 (B4) — 오늘 day_type 기준.

    교통카드 통계(stcis) 수동 적재 데이터라, 테이블이 비면 빈 배열을 준다.
    프런트는 빈 배열이면 혼잡 섹션 자체를 렌더하지 않는다(가짜 시드 금지 정책).
    """
    if direction not in ("up", "down"):
        raise HTTPException(status_code=400, detail="direction 은 up 또는 down 이어야 합니다.")
    d = datetime.now(KST).date()
    result = await get_crowding_profile(db, station, line, direction, d)
    # 수동 적재(월 단위) 데이터라 1시간 브라우저/엣지 캐시로 충분하다.
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=21600"
    return ApiResponse[list[dict]].ok(result)


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
