"""통합 대시보드 API — 셔틀·버스·지하철 정보를 한 번에 반환."""

import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.dashboard import DashboardResponse
from app.services.bus import get_arrivals
from app.services.shuttle import get_next as shuttle_get_next
from app.services.subway import get_next as subway_get_next

KST = ZoneInfo("Asia/Seoul")

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])

# 기본 버스 정류장: 한국공학대학교 (id=3)
_DEFAULT_BUS_STATION_ID = 3


@router.get("")
@limiter.limit("30/minute")
async def dashboard(
    request: Request,
    station_id: int = Query(_DEFAULT_BUS_STATION_ID, description="버스 정류장 ID"),
    db: AsyncSession = Depends(get_db),
):
    """셔틀·버스·지하철 다음 출발 정보를 한 번에 반환.

    세 서비스를 병렬 조회하여 프론트 초기 로딩 시 API 호출 횟수를 줄인다.
    """
    now = datetime.now(KST)
    d = now.date()
    t = now.time()

    shuttle_task = shuttle_get_next(db, d, t)
    bus_task = get_arrivals(db, station_id, d, t)
    subway_task = subway_get_next(db, d, t)

    shuttle_result, bus_result, subway_result = await asyncio.gather(
        shuttle_task, bus_task, subway_task, return_exceptions=True
    )

    return ApiResponse[DashboardResponse].ok(
        DashboardResponse(
            shuttle=shuttle_result if not isinstance(shuttle_result, Exception) else None,
            bus=bus_result if not isinstance(bus_result, Exception) else None,
            subway=subway_result if not isinstance(subway_result, Exception) else None,
            updated_at=now.isoformat(),
        )
    )
