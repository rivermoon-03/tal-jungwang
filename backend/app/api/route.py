import asyncio
import logging

from fastapi import APIRouter, HTTPException, Request, Response

from app.core.cache import get_or_fetch_with_lock
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.route import DrivingRouteResponse, RouteRequest, WalkingRouteResponse
from app.services.external.kakao import KakaoApiError, fetch_driving_route
from app.services.external.tmap import fetch_walking_route

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/route", tags=["route"])

# 학교 셔틀 탑승지 → 정왕역 (고정 경로)
_SCHOOL_LNG = 126.73279
_SCHOOL_LAT = 37.339343
_STATION_LNG = 126.742747
_STATION_LAT = 37.351618
_TAXI_CACHE_KEY = "route:taxi_to_station"
_TAXI_CACHE_TTL = 300  # 5분

_WALKING_CACHE_TTL = 86400  # 24시간 (도보 경로는 교통 상황 무관)
# 5분 = 택시 관련 다른 driving 캐시(_TAXI_CACHE_TTL, taxi-to-station)와 동일 수준.
# 자동차는 실시간 교통 상황을 반영해야 하므로 walk(24h)만큼 늘리지 않고 유지한다.
_DRIVING_CACHE_TTL = 300   # 5분 (자동차는 교통 상황 반영)

# 도보 경로 캐시 키 해상도 — 50m grid로 스냅하여 GPS 미세 변동에도 hit되도록
_WALK_SNAP_STEP = 0.0005  # 위도 1° ≈ 111km → 0.0005° ≈ 55m

# 자동차 경로 캐시 키 해상도 — walk 수준(55m)까지 넓히면 도로망 특성상
# 살짝 다른 좌표가 완전히 다른 경로(진입 차선/회전 제약 등)로 튈 위험이 있어
# 안전 범위(30~50m) 내에서 walk보다 약간 좁게 잡는다.
_DRIVING_SNAP_STEP = 0.0004  # 위도 1° ≈ 111km → 0.0004° ≈ 44m

# 수도권 남서부 bounding box — 익명 호출자가 임의 좌표로 외부 API 쿼터 고갈하는 것 방지
_BBOX_LAT_MIN, _BBOX_LAT_MAX = 37.0, 37.8
_BBOX_LNG_MIN, _BBOX_LNG_MAX = 126.4, 127.3


def _require_in_bbox(lat: float, lng: float) -> None:
    if not (_BBOX_LAT_MIN <= lat <= _BBOX_LAT_MAX and _BBOX_LNG_MIN <= lng <= _BBOX_LNG_MAX):
        raise HTTPException(status_code=422, detail="서비스 범위(수도권 남서부)를 벗어난 좌표입니다.")

# 택시 카드 — 학교 정문 → 주요 목적지
_TAXI_ORIGIN_LAT = 37.3400
_TAXI_ORIGIN_LNG = 126.7335
_TAXI_DEST_TTL = 1200  # 20분

_TAXI_DESTINATIONS = [
    {"id": "jeongwang_station",          "name": "정왕역",       "lat": 37.351618, "lng": 126.742747},
    {"id": "siheung_cityhall_station",   "name": "시흥시청역",   "lat": 37.37970,  "lng": 126.80260},
    {"id": "sadang_station",             "name": "사당역",        "lat": 37.47624,  "lng": 126.98175},
    {"id": "baegot_raon",                "name": "배곧(라온초)", "lat": 37.37258,  "lng": 126.73493},
]


def _snap(v: float, step: float = _WALK_SNAP_STEP) -> float:
    """좌표를 step 단위 grid로 스냅."""
    return round(v / step) * step


def _coord_cache_key(prefix: str, origin_lat: float, origin_lng: float,
                     dest_lat: float, dest_lng: float,
                     step: float = _DRIVING_SNAP_STEP) -> str:
    """좌표를 step 단위 grid로 스냅하여 캐시 키를 생성한다(기본: driving 44m grid)."""
    return (
        f"{prefix}:"
        f"{_snap(origin_lat, step):.5f},{_snap(origin_lng, step):.5f}"
        f":{_snap(dest_lat, step):.5f},{_snap(dest_lng, step):.5f}"
    )


def _walk_cache_key(origin_lat: float, origin_lng: float,
                    dest_lat: float, dest_lng: float) -> str:
    """도보 캐시 키 — 50m grid로 스냅하여 GPS 미세 변동 무시."""
    return (
        "route:walking:"
        f"{_snap(origin_lat):.5f},{_snap(origin_lng):.5f}"
        f":{_snap(dest_lat):.5f},{_snap(dest_lng):.5f}"
    )


@router.get("/taxi-to-station")
@limiter.limit("30/minute")
async def taxi_to_station(request: Request, response: Response):
    """학교 셔틀 탑승지 → 정왕역 자동차 이동 시간 (카카오모빌리티, 5분 캐시)."""
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=1200"

    async def _fetch() -> dict:
        result = await fetch_driving_route(
            origin_x=_SCHOOL_LNG, origin_y=_SCHOOL_LAT,
            dest_x=_STATION_LNG, dest_y=_STATION_LAT,
        )
        return {"duration_seconds": result.get("duration_seconds", 0)}

    try:
        payload = await get_or_fetch_with_lock(_TAXI_CACHE_KEY, _TAXI_CACHE_TTL, _fetch)
        return ApiResponse.ok(payload)
    except KakaoApiError as exc:
        logger.warning("택시-정왕역 소요시간 조회 실패, null로 폴백: %s", exc)
        return ApiResponse.ok({"duration_seconds": None})


@router.post("/walking")
@limiter.limit("30/minute")
async def walking_route(request: Request, response: Response, req: RouteRequest):
    """도보 경로 탐색 (TMAP, 좌표 기반 10분 캐시)."""
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
    origin_lat = req.origin.lat
    origin_lng = req.origin.lng
    dest_lat = req.destination.lat
    dest_lng = req.destination.lng
    _require_in_bbox(origin_lat, origin_lng)
    _require_in_bbox(dest_lat, dest_lng)

    cache_key = _walk_cache_key(origin_lat, origin_lng, dest_lat, dest_lng)

    result = await get_or_fetch_with_lock(
        cache_key,
        _WALKING_CACHE_TTL,
        lambda: fetch_walking_route(
            start_x=origin_lng,
            start_y=origin_lat,
            end_x=dest_lng,
            end_y=dest_lat,
        ),
    )

    return ApiResponse[WalkingRouteResponse].ok(result)


@router.get("/taxi-destinations")
@limiter.limit("30/minute")
async def taxi_destinations(request: Request, response: Response):
    """학교 정문 → 주요 목적지 자동차 소요 시간 목록 (카카오모빌리티, 20분 캐시)."""
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=1200"

    async def fetch_one(dest: dict) -> dict:
        cache_key = f"route:taxi_dest_v2:{dest['id']}"

        async def _fetch() -> dict:
            try:
                result = await fetch_driving_route(
                    origin_x=_TAXI_ORIGIN_LNG, origin_y=_TAXI_ORIGIN_LAT,
                    dest_x=dest["lng"], dest_y=dest["lat"],
                )
                return {
                    "id": dest["id"],
                    "name": dest["name"],
                    "duration_seconds": result["duration_seconds"],
                    "distance_meters": result["distance_meters"],
                    "taxi_fee": result["taxi_fee"],
                    "coordinates": result["coordinates"],
                }
            except KakaoApiError as exc:
                # 실패해도 null placeholder를 캐싱한다(기존 동작 유지) — 카드 자체는 항상 보이게.
                logger.warning("택시 목적지 [%s] 소요시간 조회 실패, null로 폴백: %s", dest["id"], exc)
                return {
                    "id": dest["id"],
                    "name": dest["name"],
                    "duration_seconds": None,
                    "distance_meters": None,
                    "taxi_fee": None,
                    "coordinates": [],
                }

        return await get_or_fetch_with_lock(cache_key, _TAXI_DEST_TTL, _fetch)

    results = await asyncio.gather(*[fetch_one(d) for d in _TAXI_DESTINATIONS])
    return ApiResponse.ok({"destinations": list(results)})


@router.post("/driving")
@limiter.limit("30/minute")
async def driving_route(request: Request, response: Response, req: RouteRequest):
    """자동차 경로 탐색 (카카오모빌리티, 좌표 기반 5분 캐시)."""
    response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=300"
    origin_lat = req.origin.lat
    origin_lng = req.origin.lng
    dest_lat = req.destination.lat
    dest_lng = req.destination.lng
    _require_in_bbox(origin_lat, origin_lng)
    _require_in_bbox(dest_lat, dest_lng)

    cache_key = _coord_cache_key("route:driving", origin_lat, origin_lng, dest_lat, dest_lng)

    try:
        result = await get_or_fetch_with_lock(
            cache_key,
            _DRIVING_CACHE_TTL,
            lambda: fetch_driving_route(
                origin_x=origin_lng,
                origin_y=origin_lat,
                dest_x=dest_lng,
                dest_y=dest_lat,
            ),
        )
    except KakaoApiError as exc:
        logger.warning("자동차 경로 탐색 실패: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="경로 탐색 서비스에 일시적으로 문제가 발생했습니다. 잠시 후 다시 시도해주세요.",
        ) from exc

    return ApiResponse[DrivingRouteResponse].ok(result)
