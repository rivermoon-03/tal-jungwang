from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.shuttle import ShuttleNextResponse, ShuttleScheduleResponse
from app.services.shuttle import get_next, get_schedule

KST = ZoneInfo("Asia/Seoul")

router = APIRouter(prefix="/api/v1/shuttle", tags=["shuttle"])


@router.get("/schedule")
@limiter.limit("60/minute")
async def shuttle_schedule(
    request: Request,
    date_str: str | None = Query(None, alias="date"),
    direction: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        d = date.fromisoformat(date_str) if date_str else date.today()
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식은 YYYY-MM-DD 이어야 합니다.")
    result = await get_schedule(db, d, direction)
    if not result:
        return ApiResponse.fail("NO_SCHEDULE", "해당 날짜에 적용되는 스케줄이 없습니다.")
    return ApiResponse[ShuttleScheduleResponse].ok(result)


@router.get("/next")
async def shuttle_next(
    direction: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(KST)
    d = now.date()
    t = now.time()
    result = await get_next(db, d, t, direction)
    if not result:
        return ApiResponse.fail("NO_SHUTTLE", "오늘 남은 셔틀이 없습니다.")
    return ApiResponse[ShuttleNextResponse].ok(result)
