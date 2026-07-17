import asyncio
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import verify_token
from app.core.cache import get_cached_json, get_or_fetch_with_lock, set_cached_json
from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.traffic import RoadTraffic, TrafficFlowResponse, TrafficResponse
from app.services.external.tmap import fetch_driving_traffic
from app.services.traffic import collect_traffic, get_history, persist_traffic_segments
from app.services.traffic_flow import compute_flow

_KST = ZoneInfo("Asia/Seoul")
_TRAFFIC_LIVE_CACHE_KEY = "traffic:live"
_TRAFFIC_RUSH_TTL = 60    # 출퇴근 시간대 1분
_TRAFFIC_NORMAL_TTL = 300  # 평시 5분


# 러시아워/평시 판정이 바뀌는 시각(KST, 24h). 07~10시, 16~19시가 러시아워.
_TTL_BOUNDARY_HOURS = (7, 10, 16, 19)


def _seconds_until_next_boundary(now: datetime) -> int:
    """now 이후 가장 가까운 러시아워/평시 경계 시각까지 남은 초(자정 넘김 포함)."""
    candidates = []
    for h in _TTL_BOUNDARY_HOURS:
        candidate = datetime.combine(now.date(), time(hour=h), tzinfo=_KST)
        if candidate <= now:
            candidate += timedelta(days=1)
        candidates.append(candidate)
    return int((min(candidates) - now).total_seconds())


def _traffic_ttl(now: datetime | None = None) -> int:
    """현재 KST 시각에 따른 교통 캐시 TTL 반환.
    출퇴근 (07~09, 16~18): 60초 / 그 외: 300초

    캐시 저장 시점의 러시/평시 판정만으로 TTL을 고정하면, 예를 들어 08:59에
    저장된 5분(300초) 평시 TTL 캐시가 09:00~09:04 러시아워 구간까지 그대로
    남아 최대 5분간 stale해질 수 있다. 이를 막기 위해 "다음 경계까지 남은
    시간"과 기존 TTL 중 더 짧은 쪽으로 clamp한다.
    """
    now = now or datetime.now(_KST)
    hour = now.hour
    base_ttl = _TRAFFIC_RUSH_TTL if (7 <= hour < 10 or 16 <= hour < 19) else _TRAFFIC_NORMAL_TTL
    return max(1, min(base_ttl, _seconds_until_next_boundary(now)))

router = APIRouter(prefix="/api/v1/traffic", tags=["traffic"])

# ── 조회할 경로 (양방향) ──────────────────────────────────────
# 한국공학대 ↔ 정왕역 구간을 양방향으로 호출하면
# TMAP이 실제 경유 도로명(정왕대로, 마유로 등)을 알려줌
ROUTES = [
    # 한국공학대 ↔ 정왕역 양방향
    {
        "direction": "to_station",
        "start": {"lng": 126.7335, "lat": 37.3403},    # 한국공학대
        "end":   {"lng": 126.742747, "lat": 37.351618}, # 정왕역
    },
    {
        "direction": "to_school",
        "start": {"lng": 126.742747, "lat": 37.351618}, # 정왕역
        "end":   {"lng": 126.7335, "lat": 37.3403},    # 한국공학대
    },
]

# 관심 도로명 (TMAP 경로 탐색에서 실제 반환되는 이름 기준)
TARGET_ROADS = {"마유로", "공단1대로", "희망공원로", "산기대학로", "옥구공원로", "군자천로"}

SPEED_THRESHOLDS = [
    (38, "원활"),    # >= 38 km/h
    (18, "서행"),    # >= 18 km/h
    (8,  "지체"),    # >= 8 km/h
    (0,  "정체"),    # < 8 km/h
]

# 도로별 보정 임계값 (큰 도로임에도 구조적으로 속도가 낮은 구간)
# 형식: [(threshold, congestion_level, label), ...]  내림차순
_ROAD_THRESHOLDS: dict[str, list[tuple[int, int, str]]] = {
    "마유로": [
        (17, 1, "원활"),   # >= 17 km/h → 원활
        (10, 2, "서행"),   # 10~17 km/h → 서행
        (0,  4, "정체"),   # < 10 km/h → 정체
    ],
}


def _classify_speed(speed: float, road_name: str = "") -> tuple[int, str]:
    """속도 기반 혼잡도 판별. (congestion_level, label) 반환."""
    thresholds = _ROAD_THRESHOLDS.get(road_name)
    if thresholds:
        for threshold, level, label in thresholds:
            if speed >= threshold:
                return level, label
        return 4, "정체"
    for threshold, label in SPEED_THRESHOLDS:
        if speed >= threshold:
            level = {38: 1, 18: 2, 8: 3, 0: 4}[threshold]
            return level, label
    return 4, "정체"


async def _fetch_traffic_payload() -> dict:
    """TMAP 왕복 경로 호출 → 도로별 구간 합산 → 응답 페이로드 생성.

    부수효과로 DB에 원시 구간을 백그라운드 저장한다(예측 데이터 축적용).
    single-flight 락 하에서 1건만 호출되므로, 캐시 미스마다 이 부수효과가
    중복 실행되지 않는다.
    """
    tasks = [
        fetch_driving_traffic(
            start_x=r["start"]["lng"], start_y=r["start"]["lat"],
            end_x=r["end"]["lng"], end_y=r["end"]["lat"],
        )
        for r in ROUTES
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # 같은 도로+방향의 구간들을 합산
    merged: dict[tuple[str, str], dict] = {}

    for route_def, result in zip(ROUTES, results):
        if isinstance(result, Exception):
            continue

        for seg in result["segments"]:
            name = seg["road_name"]
            if name not in TARGET_ROADS:
                continue

            key = (name, route_def["direction"])
            if key not in merged:
                merged[key] = {"distance": 0, "time": 0}
            merged[key]["distance"] += seg["distance"]
            merged[key]["time"] += seg["time"]

    roads: list[RoadTraffic] = []
    for (name, direction), totals in merged.items():
        speed = round(totals["distance"] / totals["time"] * 3.6, 1) if totals["time"] > 0 else 0
        congestion, label = _classify_speed(speed, name)
        roads.append(RoadTraffic(
            road_name=name,
            direction=direction,
            congestion=float(congestion),
            congestion_label=label,
            speed=speed,
            duration_seconds=totals["time"],
            distance_meters=totals["distance"],
        ))

    # 도로명 순서 정렬
    roads.sort(key=lambda r: (r.road_name, r.direction))

    now = datetime.now(timezone.utc).astimezone()
    response_data = TrafficResponse(roads=roads, updated_at=now.isoformat())

    # ── DB 저장 (백그라운드, 예측 데이터 축적용) ──────────────────
    asyncio.create_task(persist_traffic_segments(merged, datetime.now(timezone.utc)))

    return response_data.model_dump()


@router.get("")
@limiter.limit("30/minute")
async def get_traffic(request: Request):
    """주요 도로 실시간 교통 정보 조회.

    한국공학대 ↔ 정왕역 경로를 TMAP으로 탐색하고,
    경유하는 주요 도로별 소요시간·속도를 반환합니다.
    출퇴근 시간대(07~09, 16~18) Redis 캐싱 60초, 평시 300초.
    캐시 미스 시 single-flight 락으로 동시 요청의 TMAP 중복 호출을 방지한다.
    """
    payload = await get_or_fetch_with_lock(
        _TRAFFIC_LIVE_CACHE_KEY,
        _traffic_ttl(),
        _fetch_traffic_payload,
    )
    return ApiResponse[TrafficResponse].ok(payload)


@router.get("/debug/segments")
async def debug_segments(_user: str = Depends(verify_token)):
    """TMAP이 반환하는 모든 도로 구간명을 필터 없이 반환한다. (개발용)"""
    tasks = [
        fetch_driving_traffic(
            start_x=r["start"]["lng"], start_y=r["start"]["lat"],
            end_x=r["end"]["lng"], end_y=r["end"]["lat"],
        )
        for r in ROUTES
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    out = []
    for route_def, result in zip(ROUTES, results):
        if isinstance(result, Exception):
            out.append({"direction": route_def["direction"], "error": str(result)})
            continue
        names = [
            {"road_name": s["road_name"], "distance": s["distance"], "time": s["time"]}
            for s in result["segments"] if s["road_name"]
        ]
        out.append({"direction": route_def["direction"], "segments": names})

    return ApiResponse.ok(out)


@router.post("/collect")
async def trigger_collect(_user: str = Depends(verify_token)):
    """수동으로 교통정보 수집을 트리거한다. (인증 필요)"""
    count = await collect_traffic()
    return ApiResponse.ok({
        "collected": count,
        "collected_at": datetime.now(timezone.utc).isoformat(),
    })


@router.get("/history")
@limiter.limit("30/minute")
async def traffic_history(
    request: Request,
    road_name: str | None = Query(None),
    direction: str | None = Query(None),
    since: str | None = Query(None, description="ISO datetime"),
    until: str | None = Query(None, description="ISO datetime"),
    limit: int = Query(100, le=200),
    db: AsyncSession = Depends(get_db),
):
    """저장된 교통정보 히스토리를 조회한다."""
    try:
        since_dt = datetime.fromisoformat(since) if since else None
        until_dt = datetime.fromisoformat(until) if until else None
    except ValueError:
        raise HTTPException(status_code=400, detail="datetime 형식은 ISO 8601 이어야 합니다.")

    rows = await get_history(
        db,
        road_name=road_name,
        direction=direction,
        since=since_dt,
        until=until_dt,
        limit=limit,
    )
    return ApiResponse.ok(rows)


_FLOW_CACHE_TTL = 1800  # 30분 — 곡선은 히스토리 누적 속도가 느려 천천히 변함


@router.get("/flow")
@limiter.limit("30/minute")
async def traffic_flow(
    request: Request,
    day_type: str = Query("weekday", pattern="^(weekday|weekend)$"),
    direction: str | None = Query(None, pattern="^(to_school|to_station)$"),
    db: AsyncSession = Depends(get_db),
):
    """마유로 24시간 속도·혼잡도 곡선 (30분 버킷, 최근 60일 평균).

    direction 미지정 시 양방향 평균.
    """
    cache_key = f"traffic:flow:{day_type}:{direction or 'all'}"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        return ApiResponse[TrafficFlowResponse].ok(cached)

    data = await compute_flow(
        db, road_name="마유로", day_type=day_type, direction=direction
    )
    await set_cached_json(cache_key, data, ttl=_FLOW_CACHE_TTL)
    return ApiResponse[TrafficFlowResponse].ok(data)
