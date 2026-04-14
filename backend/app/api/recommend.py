import json
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_redis
from app.core.database import get_db
from app.core.limiter import limiter
from app.models.bus import BusStop
from app.schemas.common import ApiResponse
from app.schemas.recommend import RecommendResponse
from app.services.bus import get_arrivals
from app.services.external.kakao import fetch_driving_route

KST = ZoneInfo("Asia/Seoul")

# 정왕역 좌표 (카카오맵 기준)
JEONGWANG_LAT = 37.351618
JEONGWANG_LNG = 126.742747

# 버스 탑승 시간 캐시
_BUS_RIDE_CACHE_KEY = "bus:ride_time:campus_to_jeongwang"
_BUS_RIDE_CACHE_TTL = 300   # 5분
_BUS_RIDE_FALLBACK  = 600   # 10분 (API 실패 시 기본값)

router = APIRouter(prefix="/api/v1/recommend", tags=["recommend"])


async def _get_traffic_label() -> str | None:
    """traffic:live 캐시에서 to_station 방향 최악 혼잡도 레이블을 반환한다.

    원활(1)이거나 캐시 미스이면 None 반환 — 메시지에 포함하지 않음.
    """
    try:
        redis = await get_redis()
        cached = await redis.get("traffic:live")
        if not cached:
            return None
        roads = json.loads(cached).get("roads", [])
        to_station = [r for r in roads if r["direction"] == "to_station"]
        if not to_station:
            return None
        worst = max(to_station, key=lambda r: r["congestion"])
        if worst["congestion"] <= 1:
            return None
        return worst["congestion_label"]
    except Exception:
        return None


async def _get_bus_ride_seconds(stop_lat: float, stop_lng: float) -> int:
    """버스 정류장 → 정왕역 자동차 이동 시간 (Redis 캐시, TTL 5분).

    교통 상황이 반영된 카카오모빌리티 자동차 경로로 버스 탑승 시간을 근사한다.
    """
    try:
        redis = await get_redis()
        cached = await redis.get(_BUS_RIDE_CACHE_KEY)
        if cached:
            return int(cached)
    except Exception:
        pass

    try:
        result = await fetch_driving_route(
            origin_x=stop_lng, origin_y=stop_lat,
            dest_x=JEONGWANG_LNG, dest_y=JEONGWANG_LAT,
        )
        ride = result.get("duration_seconds", 0)
        if ride > 0:
            try:
                redis = await get_redis()
                await redis.setex(_BUS_RIDE_CACHE_KEY, _BUS_RIDE_CACHE_TTL, str(ride))
            except Exception:
                pass
            return ride
    except httpx.HTTPError:
        pass

    return _BUS_RIDE_FALLBACK


@router.get("/transport")
@limiter.limit("30/minute")
async def recommend_transport(
    request: Request,
    origin_lat: float = Query(..., ge=-90.0, le=90.0),
    origin_lng: float = Query(..., ge=-180.0, le=180.0),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(KST)
    d = now.date()
    t = now.time()

    # 1. 도보: 출발지 → 정왕역 (약 20분 고정)
    walk_seconds = 1200

    # 2. 버스: 대기 + 탑승(자동차 이동 시간 근사)
    bus_arrivals = await get_arrivals(db, 3, d, t)
    bus_option = {"available": False, "total_seconds": None}
    if bus_arrivals and bus_arrivals["arrivals"]:
        stmt = select(BusStop).where(BusStop.id == 3)
        row = await db.execute(stmt)
        bus_stop = row.scalar_one_or_none()
        stop_lat = float(bus_stop.lat) if bus_stop else 37.339343
        stop_lng = float(bus_stop.lng) if bus_stop else 126.73279

        first = bus_arrivals["arrivals"][0]
        bus_wait  = first.get("arrive_in_seconds", 0)
        ride_secs = await _get_bus_ride_seconds(stop_lat, stop_lng)

        bus_option = {
            "available": True,
            "route_no": first["route_no"],
            "wait_seconds": bus_wait,
            "ride_seconds": ride_secs,
            "total_seconds": bus_wait + ride_secs,
        }

    # 3. 추천 판단: 도보 vs 버스
    options = {}
    if walk_seconds > 0:
        options["walking"] = walk_seconds
    if bus_option["available"]:
        options["bus"] = bus_option["total_seconds"]

    if not options:
        recommended = "walking"
        message = "현재 교통 정보를 조회할 수 없습니다. 도보를 이용하세요."
    else:
        recommended = min(options, key=options.get)
        if recommended == "walking":
            if bus_option["available"]:
                diff = abs(options["bus"] - walk_seconds) // 60
                message = f"도보가 버스보다 {diff}분 빠릅니다" if diff > 0 else "도보와 버스 소요 시간이 비슷합니다"
            else:
                message = "걸어서 이동하세요"
        else:
            total_min = round(bus_option["total_seconds"] / 60)
            message = f"버스({bus_option.get('route_no', '')})를 추천합니다 — 약 {total_min}분"

    # 4. 도로 혼잡도 컨텍스트 prefix (원활이면 생략)
    traffic_label = await _get_traffic_label()
    if traffic_label:
        message = f"도로 {traffic_label} 중 — {message}"

    return ApiResponse[RecommendResponse].ok({
        "recommended": recommended,
        "message": message,
        "comparison": {
            "walking": {"available": True, "total_seconds": walk_seconds if walk_seconds > 0 else None},
            "bus": bus_option,
        },
        "updated_at": now.isoformat(),
    })
