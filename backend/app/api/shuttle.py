from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.shuttle import ShuttleNextResponse, ShuttleScheduleResponse
from app.services.shuttle import get_next, get_schedule, get_semester_schedule

KST = ZoneInfo("Asia/Seoul")

router = APIRouter(prefix="/api/v1/shuttle", tags=["shuttle"])


@router.get("/schedule")
@limiter.limit("60/minute")
async def shuttle_schedule(
    request: Request,
    response: Response,
    date_str: str | None = Query(None, alias="date"),
    direction: int | None = Query(None, ge=0, le=3),
    db: AsyncSession = Depends(get_db),
):
    try:
        d = date.fromisoformat(date_str) if date_str else datetime.now(KST).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식은 YYYY-MM-DD 이어야 합니다.")
    result = await get_schedule(db, d, direction)
    if not result:
        return ApiResponse.fail("NO_SCHEDULE", "해당 날짜에 적용되는 스케줄이 없습니다.")
    response.headers["Cache-Control"] = "public, max-age=600, stale-while-revalidate=3600"
    return ApiResponse[ShuttleScheduleResponse].ok(result)


@router.get("/semester-schedule")
@limiter.limit("60/minute")
async def shuttle_semester_schedule(
    request: Request,
    response: Response,
    direction: int | None = Query(None, ge=0, le=3),
    db: AsyncSession = Depends(get_db),
):
    """방학 중에도 학기 중 시간표를 조회할 수 있는 엔드포인트.
    현재 또는 가장 가까운 SEMESTER 기간의 평일(weekday) 시간표를 반환한다.
    """
    result = await get_semester_schedule(db, direction)
    if not result:
        return ApiResponse.fail("NO_SCHEDULE", "등록된 학기 스케줄이 없습니다.")
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=7200"
    return ApiResponse[ShuttleScheduleResponse].ok(result)


@router.get("/next")
async def shuttle_next(
    direction: int | None = Query(None, ge=0, le=3),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(KST)
    d = now.date()
    t = now.time()
    result = await get_next(db, d, t, direction)
    if not result:
        return ApiResponse.fail("NO_SHUTTLE", "오늘 남은 셔틀이 없습니다.")
    return ApiResponse[ShuttleNextResponse].ok(result)
