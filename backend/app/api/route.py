import json

import httpx
from fastapi import APIRouter

from app.core.cache import get_redis
from app.schemas.common import ApiResponse
from app.schemas.route import DrivingRouteResponse, RouteRequest, WalkingRouteResponse
from app.services.external.kakao import fetch_driving_route
from app.services.external.tmap import fetch_walking_route

router = APIRouter(prefix="/api/v1/route", tags=["route"])

# 학교 셔틀 탑승지 → 정왕역 (고정 경로)
_SCHOOL_LNG = 126.73279
_SCHOOL_LAT = 37.339343
_STATION_LNG = 126.742747
_STATION_LAT = 37.351618
_TAXI_CACHE_KEY = "route:taxi_to_station"
_TAXI_CACHE_TTL = 300  # 5분

_WALKING_CACHE_TTL = 600   # 10분 (도보 경로는 교통 상황 무관)
_DRIVING_CACHE_TTL = 300   # 5분 (자동차는 교통 상황 반영)


def _coord_cache_key(prefix: str, origin_lat: float, origin_lng: float,
                     dest_lat: float, dest_lng: float) -> str:
    """좌표를 소수점 4자리로 반올림하여 캐시 키를 생성한다."""
    return (
        f"{prefix}:"
        f"{origin_lat:.4f},{origin_lng:.4f}"
        f":{dest_lat:.4f},{dest_lng:.4f}"
    )


@router.get("/taxi-to-station")
async def taxi_to_station():
    """학교 셔틀 탑승지 → 정왕역 자동차 이동 시간 (카카오모빌리티, 5분 캐시)."""
    try:
        redis = await get_redis()
        cached = await redis.get(_TAXI_CACHE_KEY)
        if cached:
            return ApiResponse.ok({"duration_seconds": int(cached)})
    except Exception:
        pass

    try:
        result = await fetch_driving_route(
            origin_x=_SCHOOL_LNG, origin_y=_SCHOOL_LAT,
            dest_x=_STATION_LNG, dest_y=_STATION_LAT,
        )
        secs = result.get("duration_seconds", 0)
        try:
            redis = await get_redis()
            await redis.setex(_TAXI_CACHE_KEY, _TAXI_CACHE_TTL, str(secs))
        except Exception:
            pass
        return ApiResponse.ok({"duration_seconds": secs})
    except httpx.HTTPError:
        return ApiResponse.ok({"duration_seconds": None})


@router.post("/walking")
async def walking_route(req: RouteRequest):
    """도보 경로 탐색 (TMAP, 좌표 기반 10분 캐시)."""
    origin_lat = req.origin.lat
    origin_lng = req.origin.lng
    dest_lat = req.destination.lat
    dest_lng = req.destination.lng

    cache_key = _coord_cache_key("route:walking", origin_lat, origin_lng, dest_lat, dest_lng)

    try:
        redis = await get_redis()
        cached = await redis.get(cache_key)
        if cached:
            return ApiResponse[WalkingRouteResponse].ok(json.loads(cached))
    except Exception:
        pass

    result = await fetch_walking_route(
        start_x=origin_lng,
        start_y=origin_lat,
        end_x=dest_lng,
        end_y=dest_lat,
    )

    try:
        redis = await get_redis()
        await redis.setex(cache_key, _WALKING_CACHE_TTL, json.dumps(result))
    except Exception:
        pass

    return ApiResponse[WalkingRouteResponse].ok(result)


@router.post("/driving")
async def driving_route(req: RouteRequest):
    """자동차 경로 탐색 (카카오모빌리티, 좌표 기반 5분 캐시)."""
    origin_lat = req.origin.lat
    origin_lng = req.origin.lng
    dest_lat = req.destination.lat
    dest_lng = req.destination.lng

    cache_key = _coord_cache_key("route:driving", origin_lat, origin_lng, dest_lat, dest_lng)

    try:
        redis = await get_redis()
        cached = await redis.get(cache_key)
        if cached:
            return ApiResponse[DrivingRouteResponse].ok(json.loads(cached))
    except Exception:
        pass

    result = await fetch_driving_route(
        origin_x=origin_lng,
        origin_y=origin_lat,
        dest_x=dest_lng,
        dest_y=dest_lat,
    )

    try:
        redis = await get_redis()
        await redis.setex(cache_key, _DRIVING_CACHE_TTL, json.dumps(result))
    except Exception:
        pass

    return ApiResponse[DrivingRouteResponse].ok(result)
