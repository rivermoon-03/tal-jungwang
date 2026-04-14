"""교통정보 수집 및 히스토리 조회 서비스."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.traffic import TrafficHistory
from app.services.external.tmap import fetch_driving_traffic

logger = logging.getLogger(__name__)

# ── 수집 대상 도로 구간 ──────────────────────────────────────
# 마유로: 한국공학대 ↔ 정왕역 직통 도로 (가장 메인)
COLLECTION_ROUTES = [
    {
        "direction": "to_station",
        "start": {"lng": 126.7335,   "lat": 37.3403},    # 한국공학대
        "end":   {"lng": 126.742747, "lat": 37.351618},  # 정왕역
    },
    {
        "direction": "to_school",
        "start": {"lng": 126.742747, "lat": 37.351618},  # 정왕역
        "end":   {"lng": 126.7335,   "lat": 37.3403},    # 한국공학대
    },
]

# 마유로 + 주변 주요 도로
TARGET_ROADS = {"마유로", "공단1대로", "산기대학로"}

SPEED_THRESHOLDS = [
    (40, 1),  # 원활
    (20, 2),  # 서행
    (10, 3),  # 지체
    (0,  4),  # 정체
]


def _speed_to_congestion(speed: float) -> int:
    for threshold, level in SPEED_THRESHOLDS:
        if speed >= threshold:
            return level
    return 4


async def persist_traffic_segments(
    merged: dict[tuple[str, str], dict],
    now: datetime,
) -> int:
    """merged 구간 데이터를 DB에 저장한다. 저장 건수를 반환.

    merged 키: (road_name, direction)
    merged 값: {"distance": meters, "time": seconds}
    """
    async with AsyncSessionLocal() as db:
        count = 0
        for (road_name, direction), totals in merged.items():
            speed = round(totals["distance"] / totals["time"] * 3.6, 1) if totals["time"] > 0 else 0
            db.add(TrafficHistory(
                road_name=road_name,
                direction=direction,
                speed=speed,
                duration_seconds=totals["time"],
                distance_meters=totals["distance"],
                congestion=_speed_to_congestion(speed),
                collected_at=now,
            ))
            count += 1
        await db.commit()
    return count


async def collect_traffic() -> int:
    """TMAP API로 교통정보를 수집하여 DB에 저장한다. 저장 건수를 반환."""
    now = datetime.now(timezone.utc)
    merged: dict[tuple[str, str], dict] = {}

    for route in COLLECTION_ROUTES:
        try:
            result = await fetch_driving_traffic(
                start_x=route["start"]["lng"], start_y=route["start"]["lat"],
                end_x=route["end"]["lng"], end_y=route["end"]["lat"],
            )
        except Exception:
            logger.exception("Traffic fetch failed for %s", route["direction"])
            continue

        for seg in result["segments"]:
            name = seg["road_name"]
            if name not in TARGET_ROADS:
                continue
            key = (name, route["direction"])
            if key not in merged:
                merged[key] = {"distance": 0, "time": 0}
            merged[key]["distance"] += seg["distance"]
            merged[key]["time"] += seg["time"]

    count = await persist_traffic_segments(merged, now)
    logger.info("Traffic collected: %d records at %s", count, now.isoformat())
    return count


async def get_history(
    db: AsyncSession,
    road_name: str | None = None,
    direction: str | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
    limit: int = 500,
) -> list[dict]:
    """저장된 교통 히스토리를 조회한다."""
    stmt = select(TrafficHistory).order_by(TrafficHistory.collected_at.desc())

    if road_name:
        stmt = stmt.where(TrafficHistory.road_name == road_name)
    if direction:
        stmt = stmt.where(TrafficHistory.direction == direction)
    if since:
        stmt = stmt.where(TrafficHistory.collected_at >= since)
    if until:
        stmt = stmt.where(TrafficHistory.collected_at <= until)

    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "id": r.id,
            "road_name": r.road_name,
            "direction": r.direction,
            "speed": float(r.speed),
            "duration_seconds": r.duration_seconds,
            "distance_meters": r.distance_meters,
            "congestion": r.congestion,
            "collected_at": r.collected_at.isoformat(),
        }
        for r in rows
    ]
