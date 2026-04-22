from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.subway import SubwayNextResponse, SubwayRealtimeItem, SubwayTimetableResponse
from app.services.subway import get_next, get_timetable
from app.services.subway_realtime import get_all_realtime_cached

KST = ZoneInfo("Asia/Seoul")

router = APIRouter(prefix="/api/v1/subway", tags=["subway"])


@router.get("/timetable")
@limiter.limit("60/minute")
async def subway_timetable(
    request: Request,
    date_str: str | None = Query(None, alias="date"),
    direction: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        d = date.fromisoformat(date_str) if date_str else datetime.now(KST).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식은 YYYY-MM-DD 이어야 합니다.")
    result = await get_timetable(db, d, direction)
    return ApiResponse[SubwayTimetableResponse].ok(result)


@router.get("/next")
async def subway_next(
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(KST)
    d = now.date()
    t = now.time()
    result = await get_next(db, d, t)
    return ApiResponse[SubwayNextResponse].ok(result)


@router.get("/realtime")
@limiter.limit("60/minute")
async def subway_realtime(request: Request):
    data = await get_all_realtime_cached()
    return ApiResponse[dict].ok(data)
