"""버스 도착정보 백그라운드 수집기.

38초 간격으로 GBIS API를 폴링하여:
1. Redis에 도착정보 캐시 (프론트 응답용)
2. 이전 상태와 비교하여 도착 판정 → DB 기록
"""

import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.cache import get_redis
from app.core.database import AsyncSessionLocal
from app.models.bus import BusArrivalHistory, BusCrowdingLog, BusRoute, BusStop
from app.services.external.gbis import fetch_arrivals

from sqlalchemy import select
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")

# 이전 폴링에서 predictTimeSec이 이 값 이하였던 차량이 사라지면 도착으로 판정
ARRIVAL_THRESHOLD_SEC = 90

# 이전 폴링에 없었던 차량이 이번에 이 값 이하로 처음 등장하면 도착으로 추정
# (폴링 간격 45초 안에 등장·도착·출발이 끝나는 경우 대비)
FIRST_SIGHT_ARRIVAL_SEC = 30

CACHE_TTL = 80  # 캐시 TTL (초) — 폴링 간격(38초)의 2.1배 (1회 미싱 버퍼)

# 노선번호별 최소 폴링 간격 (초). 빈 dict = 전 노선 매 사이클 처리.
ROUTE_POLL_INTERVALS: dict[str, int] = {}


async def _is_route_due(redis, stop_id: int, route_id: int, route_number: str) -> bool:
    interval = ROUTE_POLL_INTERVALS.get(route_number)
    if not interval:
        return True
    key = f"bus:route_poll:{stop_id}:{route_id}"
    if await redis.exists(key):
        return False
    await redis.set(key, "1", ex=interval)
    return True


def _day_type(dt: datetime) -> str:
    wd = dt.weekday()
    if wd < 5:
        return "weekday"
    if wd == 5:
        return "saturday"
    return "sunday"


async def _load_realtime_stations(db) -> list[dict]:
    """실시간 노선이 연결된 정류장 목록 로드."""
    stmt = select(BusStop).options(selectinload(BusStop.routes))
    result = await db.execute(stmt)
    stops = result.scalars().all()

    targets = []
    for stop in stops:
        rt_routes = [r for r in stop.routes if r.is_realtime and r.gbis_route_id]
        if rt_routes and stop.gbis_station_id:
            targets.append({
                "stop_id": stop.id,
                "stop_name": stop.name,
                "gbis_station_id": stop.gbis_station_id,
                "routes": {r.gbis_route_id: r for r in rt_routes},
            })
    return targets


async def poll_and_collect():
    """1회 폴링 사이클: GBIS 호출 → 캐시 저장 → 도착 판정 → DB 기록."""
    redis = await get_redis()
    now = datetime.now(_KST)

    async with AsyncSessionLocal() as db:
        targets = await _load_realtime_stations(db)

        for target in targets:
            station_id = target["gbis_station_id"]
            try:
                items = await fetch_arrivals(station_id)
            except Exception:
                logger.warning("GBIS 폴링 실패 (정류장 %s)", target["stop_name"], exc_info=True)
                continue

            # ── 1. Redis 캐시 저장 (프론트 응답용) ─────────────────────
            # route 매칭 후 프론트에 내려줄 형태로 변환
            gbis_id_to_route: dict[str, BusRoute] = target["routes"]
            arrivals_for_cache = []

            # 이번 사이클에 실제로 처리할 노선 (간격 미달 노선 제외)
            due_routes: dict[str, BusRoute] = {}
            for gbis_route_id, route in gbis_id_to_route.items():
                if await _is_route_due(redis, target["stop_id"], route.id, route.route_number):
                    due_routes[gbis_route_id] = route

            for item in items:
                route = due_routes.get(item["route_id"])
                if not route:
                    continue

                sec1 = item.get("predict_time_sec1", 0)
                sec2 = item.get("predict_time_sec2", 0)
                if not sec1:
                    sec1 = item.get("predict_time1", 0) * 60
                if not sec2:
                    sec2 = item.get("predict_time2", 0) * 60

                if sec1:
                    arrivals_for_cache.append({
                        "route_id": route.id,
                        "route_no": route.route_number,
                        "destination": route.direction_name,
                        "category": route.category,
                        "arrival_type": "realtime",
                        "depart_at": None,
                        "arrive_in_seconds": sec1,
                        "is_tomorrow": False,
                        "crowded": item.get("crowded1", 0),
                    })
                if sec2:
                    arrivals_for_cache.append({
                        "route_id": route.id,
                        "route_no": route.route_number,
                        "destination": route.direction_name,
                        "category": route.category,
                        "arrival_type": "realtime",
                        "depart_at": None,
                        "arrive_in_seconds": sec2,
                        "is_tomorrow": False,
                        "crowded": item.get("crowded2", 0),
                    })

            # cached_at을 함께 저장해 서빙 시 경과 시간만큼 arrive_in_seconds를 보정
            cache_payload = {
                "cached_at": now.isoformat(),
                "arrivals": arrivals_for_cache,
            }
            cache_key = f"bus:arrivals:{target['stop_id']}"
            await redis.set(
                cache_key,
                json.dumps(cache_payload, ensure_ascii=False),
                ex=CACHE_TTL,
            )

            # ── 2. 도착 판정 ──────────────────────────────────────────
            # 현재 상태: due_routes 한정 (간격 미달 노선은 도착 판정도 스킵)
            current_state: dict[str, dict] = {}
            for item in items:
                route = due_routes.get(item["route_id"])
                if not route:
                    continue
                plate = item.get("plate_no1", "")
                sec = item.get("predict_time_sec1", 0) or item.get("predict_time1", 0) * 60
                if plate and sec:
                    current_state[plate] = {
                        "route_id": item["route_id"],
                        "db_route_id": route.id,
                        "sec": sec,
                    }

            # 이전 상태 로드
            prev_key = f"bus:prev:{station_id}"
            prev_raw = await redis.get(prev_key)
            prev_state: dict[str, dict] = json.loads(prev_raw) if prev_raw else {}

            # 중복 기록 방지용 plate 집합 (10분 TTL)
            counted_key = f"bus:counted:{station_id}"
            counted_raw = await redis.get(counted_key)
            counted_plates: set[str] = set(json.loads(counted_raw)) if counted_raw else set()

            new_arrivals: list[BusArrivalHistory] = []

            # ── 2a. 이전에 있었는데 지금 없는 차량 → 도착 판정 ──
            arrived_plates = set(prev_state.keys()) - set(current_state.keys())
            for plate in arrived_plates:
                if plate in counted_plates:
                    continue
                prev = prev_state[plate]
                if prev.get("sec", 9999) <= ARRIVAL_THRESHOLD_SEC:
                    new_arrivals.append(BusArrivalHistory(
                        route_id=prev["db_route_id"],
                        stop_id=target["stop_id"],
                        plate_no=plate,
                        arrived_at=now,
                        day_type=_day_type(now),
                        source="detected",
                    ))
                    counted_plates.add(plate)
                    logger.info(
                        "도착 판정: %s → %s (이전 %d초)",
                        plate, target["stop_name"], prev["sec"],
                    )

            # ── 2b. 이번 폴링에 처음 등장 + sec ≤ 30 → 도착 추정 ──
            for plate, state in current_state.items():
                if plate in prev_state or plate in counted_plates:
                    continue
                if state["sec"] <= FIRST_SIGHT_ARRIVAL_SEC:
                    new_arrivals.append(BusArrivalHistory(
                        route_id=state["db_route_id"],
                        stop_id=target["stop_id"],
                        plate_no=plate,
                        arrived_at=now,
                        day_type=_day_type(now),
                        source="estimated",
                    ))
                    counted_plates.add(plate)
                    logger.info(
                        "첫등장 도착 추정: %s → %s (sec %d)",
                        plate, target["stop_name"], state["sec"],
                    )

            if new_arrivals:
                db.add_all(new_arrivals)
                await db.commit()

            # ── 3. 혼잡도 로그 저장 ──────────────────────────────────────────
            crowding_logs: list[BusCrowdingLog] = []
            for item in items:
                route = due_routes.get(item["route_id"])
                if not route:
                    continue
                for crowded_key, sec_key, plate_key in [
                    ("crowded1", "predict_time_sec1", "plate_no1"),
                    ("crowded2", "predict_time_sec2", "plate_no2"),
                ]:
                    crowded = item.get(crowded_key, 0)
                    sec = item.get(sec_key, 0) or 0
                    plate = item.get(plate_key, "") or ""
                    if crowded and sec:
                        crowding_logs.append(BusCrowdingLog(
                            route_id=route.id,
                            stop_id=target["stop_id"],
                            plate_no=plate,
                            crowded=crowded,
                            arrive_in_seconds=sec,
                            recorded_at=now,
                        ))
            if crowding_logs:
                db.add_all(crowding_logs)
                await db.commit()

            # 현재 상태를 이전 상태로 저장 (38초 폴링 × 3.7사이클 버퍼)
            await redis.set(prev_key, json.dumps(current_state, ensure_ascii=False), ex=140)
            # 이미 집계한 plate 목록 저장 (중복 기록 방지)
            if counted_plates:
                await redis.set(
                    counted_key,
                    json.dumps(list(counted_plates), ensure_ascii=False),
                    ex=600,
                )

    logger.info("버스 폴링 완료 (%d 정류장)", len(targets))
