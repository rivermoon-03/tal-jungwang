from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cached_json, set_cached_json
from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.now import NowDeparture, NowDeparturesResponse
from app.services.now import get_now_departures

KST = ZoneInfo("Asia/Seoul")

router = APIRouter(prefix="/api/v1/now", tags=["now"])

_TTL = 30  # seconds — 폴링 주기와 동일


@router.get("/departures")
@limiter.limit("60/minute")
async def now_departures(
    request: Request,
    mode: str = Query(..., pattern="^(등교|하교|지하철)$"),
    destination: str | None = Query(None),
    subway_station: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Now 탭 통합 출발 정보.

    mode:
      - "등교": 한국공학대·이마트 정류장에서 '등교' 카테고리 버스 + 셔틀
      - "하교": 같은 정류장 '하교' 카테고리 버스 + 셔틀 (destination으로 추가 필터)
      - "지하철": 정왕역 기준 모든 방향 다음 열차
    """
    selection = destination or subway_station or "default"
    selection_key = f"{mode}:{selection}"
    cache_key = f"now:departures:{selection_key}"

    cached = await get_cached_json(cache_key)
    if cached is not None:
        return ApiResponse[NowDeparturesResponse].ok(cached)

    now = datetime.now(KST)
    deps = await get_now_departures(db, mode, destination, subway_station, now)

    payload = NowDeparturesResponse(
        mode=mode,
        selection_key=selection_key,
        updated_at=now.isoformat(),
        departures=deps,
    )

    await set_cached_json(cache_key, payload.model_dump(), ttl=_TTL)
    return ApiResponse[NowDeparturesResponse].ok(payload)
