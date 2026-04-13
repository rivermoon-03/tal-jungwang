import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.traffic import RoadTraffic, TrafficResponse
from app.services.external.tmap import fetch_driving_traffic
from app.services.traffic import collect_traffic, get_history

router = APIRouter(prefix="/api/v1/traffic", tags=["traffic"])

# ── 조회할 경로 (양방향) ──────────────────────────────────────
# 한국공학대 ↔ 정왕역 구간을 양방향으로 호출하면
# TMAP이 실제 경유 도로명(정왕대로, 마유로 등)을 알려줌
ROUTES = [
    # 한국공학대 ↔ 정왕역 양방향
    {
        "direction": "to_station",
        "start": {"lng": 126.7335, "lat": 37.3403},  # 한국공학대
        "end":   {"lng": 126.7198, "lat": 37.3399},   # 정왕역
    },
    {
        "direction": "to_school",
        "start": {"lng": 126.7198, "lat": 37.3399},
        "end":   {"lng": 126.7335, "lat": 37.3403},
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
    return ApiResponse[TrafficResponse].ok(
        TrafficResponse(roads=roads, updated_at=now.isoformat())
    )


@router.post("/collect")
async def trigger_collect():
    """수동으로 교통정보 수집을 트리거한다."""
    count = await collect_traffic()
    return ApiResponse.ok({
        "collected": count,
        "collected_at": datetime.now(timezone.utc).isoformat(),
    })


@router.get("/history")
async def traffic_history(
    road_name: str | None = Query(None),
    direction: str | None = Query(None),
    since: str | None = Query(None, description="ISO datetime"),
    until: str | None = Query(None, description="ISO datetime"),
    limit: int = Query(500, le=2000),
    db: AsyncSession = Depends(get_db),
):
    """저장된 교통정보 히스토리를 조회한다."""
    since_dt = datetime.fromisoformat(since) if since else None
    until_dt = datetime.fromisoformat(until) if until else None

    rows = await get_history(
        db,
        road_name=road_name,
        direction=direction,
        since=since_dt,
        until=until_dt,
        limit=limit,
    )
    return ApiResponse.ok(rows)
