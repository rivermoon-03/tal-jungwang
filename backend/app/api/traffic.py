import asyncio
import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import verify_token
from app.core.cache import get_redis
from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.traffic import RoadTraffic, TrafficResponse
from app.services.external.tmap import fetch_driving_traffic
from app.services.traffic import collect_traffic, get_history, persist_traffic_segments

_KST = ZoneInfo("Asia/Seoul")
_TRAFFIC_LIVE_CACHE_KEY = "traffic:live"
_TRAFFIC_RUSH_TTL = 60    # 출퇴근 시간대 1분
_TRAFFIC_NORMAL_TTL = 300  # 평시 5분


def _traffic_ttl() -> int:
    """현재 KST 시각에 따른 교통 캐시 TTL 반환.
    출퇴근 (07~09, 16~18): 60초 / 그 외: 300초
    """
    hour = datetime.now(_KST).hour
    if 7 <= hour < 10 or 16 <= hour < 19:
        return _TRAFFIC_RUSH_TTL
    return _TRAFFIC_NORMAL_TTL

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
    (40, "원활"),    # >= 40 km/h
    (20, "서행"),    # >= 20 km/h
    (10, "지체"),    # >= 10 km/h
    (0,  "정체"),    # < 10 km/h
]


def _classify_speed(speed: float) -> tuple[int, str]:
    """속도 기반 혼잡도 판별. (congestion_level, label) 반환."""
    for threshold, label in SPEED_THRESHOLDS:
        if speed >= threshold:
            level = {40: 1, 20: 2, 10: 3, 0: 4}[threshold]
            return level, label
    return 4, "정체"


@router.get("")
async def get_traffic():
    """주요 도로 실시간 교통 정보 조회.

    한국공학대 ↔ 정왕역 경로를 TMAP으로 탐색하고,
    경유하는 주요 도로별 소요시간·속도를 반환합니다.
    출퇴근 시간대(07~09, 16~18) Redis 캐싱 60초, 평시 300초.
    """
    # ── 캐시 조회 ────────────────────────────────────────────────
    try:
        redis = await get_redis()
        cached = await redis.get(_TRAFFIC_LIVE_CACHE_KEY)
        if cached:
            return ApiResponse.ok(json.loads(cached))
    except Exception:
        pass

    # ── TMAP API 호출 ─────────────────────────────────────────
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
        congestion, label = _classify_speed(speed)
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

    # ── 캐시 저장 ────────────────────────────────────────────────
    try:
        redis = await get_redis()
        await redis.set(
            _TRAFFIC_LIVE_CACHE_KEY,
            json.dumps(response_data.model_dump(), ensure_ascii=False, default=str),
            ex=_traffic_ttl(),
        )
    except Exception:
        pass

    # ── DB 저장 (백그라운드, 예측 데이터 축적용) ──────────────────
    asyncio.create_task(persist_traffic_segments(merged, datetime.now(timezone.utc)))

    return ApiResponse[TrafficResponse].ok(response_data)


@router.get("/debug/segments")
async def debug_segments():
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
