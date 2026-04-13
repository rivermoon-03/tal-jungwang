import json
import logging
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.cache import get_cached_json, get_redis, set_cached_json
from app.models.bus import BusRoute, BusStop, BusTimetableEntry

_KST = ZoneInfo("Asia/Seoul")
logger = logging.getLogger(__name__)


def _day_type(d: date) -> str:
    wd = d.weekday()
    if wd < 5:
        return "weekday"
    if wd == 5:
        return "saturday"
    return "sunday"


async def get_stations(db: AsyncSession) -> list[dict]:
    cache_key = "bus:stations"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        return cached

    stmt = select(BusStop).options(selectinload(BusStop.routes)).order_by(BusStop.id)
    result = await db.execute(stmt)
    stops = result.scalars().all()

    data = [
        {
            "station_id": s.id,
            "name": s.name,
            "lat": float(s.lat),
            "lng": float(s.lng),
            "routes": [
                {
                    "route_number": r.route_number,
                    "route_name": r.route_name,
                    "is_realtime": r.is_realtime,
                }
                for r in s.routes
            ],
        }
        for s in stops
    ]
    await set_cached_json(cache_key, data, ttl=3600)
    return data


async def get_arrivals(
    db: AsyncSession, station_id: int, d: date, now_time: time
) -> dict | None:
    # 정류장 + 연결된 노선 정보 로드
    stmt = (
        select(BusStop)
        .where(BusStop.id == station_id)
        .options(selectinload(BusStop.routes))
    )
    result = await db.execute(stmt)
    stop = result.scalar_one_or_none()
    if not stop:
        return None

    day = _day_type(d)
    # now_time은 KST 기준으로 넘어오며, DB departure_time도 KST 기준
    # timezone 없이 naive datetime끼리 비교 (둘 다 KST)
    now_dt = datetime.combine(d, now_time)
    arrivals: list[dict] = []

    # ── 1. 실시간 노선: Redis 캐시에서 읽기 ─────────────────────────────────
    realtime_routes: list[BusRoute] = [r for r in stop.routes if r.is_realtime]

    if realtime_routes and stop.gbis_station_id:
        try:
            redis = await get_redis()
            cached = await redis.get(f"bus:arrivals:{station_id}")
            if cached:
                arrivals.extend(json.loads(cached))
        except Exception as exc:
            logger.warning("Redis 캐시 읽기 실패 (정류장 %s): %s", station_id, exc)

    # ── 2. 시간표 기반 노선: DB 조회 ───────────────────────────────────────
    realtime_route_ids: set[int] = {r.id for r in realtime_routes}
    timetable_route_ids: set[int] = {
        r.id for r in stop.routes if not r.is_realtime
    }

    stmt = (
        select(BusTimetableEntry, BusRoute)
        .join(BusRoute, BusTimetableEntry.route_id == BusRoute.id)
        .where(
            BusTimetableEntry.stop_id == station_id,
            BusTimetableEntry.day_type == day,
            BusTimetableEntry.departure_time > now_time,
            # 실시간 노선은 시간표 중복 출력 방지
            BusRoute.id.not_in(realtime_route_ids) if realtime_route_ids else True,
        )
        .order_by(BusTimetableEntry.departure_time)
    )
    result = await db.execute(stmt)
    rows = result.all()

    seen_timetable_routes: set[int] = set()

    for entry, route in rows:
        if route.id in seen_timetable_routes:
            continue
        seen_timetable_routes.add(route.id)

        depart_dt = datetime.combine(d, entry.departure_time)
        diff = int((depart_dt - now_dt).total_seconds())

        arrivals.append({
            "route_id": route.id,
            "route_no": route.route_number,
            "destination": route.direction_name,
            "arrival_type": "timetable",
            "depart_at": entry.departure_time.strftime("%H:%M"),
            "arrive_in_seconds": diff,
            "is_tomorrow": False,
        })

    # ── 2-1. 오늘 시간표 소진된 시간표 기반 노선 → 내일 첫차 조회 ────────────
    exhausted_route_ids = timetable_route_ids - seen_timetable_routes - realtime_route_ids
    if exhausted_route_ids:
        tomorrow = d + timedelta(days=1)
        tomorrow_day = _day_type(tomorrow)

        stmt_tmr = (
            select(BusTimetableEntry, BusRoute)
            .join(BusRoute, BusTimetableEntry.route_id == BusRoute.id)
            .where(
                BusTimetableEntry.stop_id == station_id,
                BusTimetableEntry.day_type == tomorrow_day,
                BusRoute.id.in_(exhausted_route_ids),
            )
            .order_by(BusTimetableEntry.route_id, BusTimetableEntry.departure_time)
        )
        result_tmr = await db.execute(stmt_tmr)
        rows_tmr = result_tmr.all()

        # 초 단위 자정까지 남은 시간
        seconds_to_midnight = (
            86400
            - now_time.hour * 3600
            - now_time.minute * 60
            - now_time.second
        )

        seen_tomorrow_routes: set[int] = set()
        for entry, route in rows_tmr:
            if route.id in seen_tomorrow_routes:
                continue
            seen_tomorrow_routes.add(route.id)

            dep = entry.departure_time
            dep_seconds = dep.hour * 3600 + dep.minute * 60 + dep.second
            arrive_in_seconds = seconds_to_midnight + dep_seconds

            arrivals.append({
                "route_id": route.id,
                "route_no": route.route_number,
                "destination": route.direction_name,
                "arrival_type": "timetable",
                "depart_at": entry.departure_time.strftime("%H:%M"),
                "arrive_in_seconds": arrive_in_seconds,
                "is_tomorrow": True,
            })

    # ── 3. 정렬: arrive_in_seconds 기준 오름차순 (None은 뒤로) ─────────────
    arrivals.sort(key=lambda x: (x["arrive_in_seconds"] is None, x["arrive_in_seconds"] or 0))

    return {
        "station_id": station_id,
        "station_name": stop.name,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "arrivals": arrivals,
    }


async def get_timetable_by_route_number(
    db: AsyncSession, route_number: str, d: date
) -> dict | None:
    """route_number(예: "3400") 문자열로 조회. ID를 모를 때 사용."""
    stmt = select(BusRoute).where(BusRoute.route_number == route_number)
    result = await db.execute(stmt)
    route = result.scalar_one_or_none()
    if not route:
        return None
    return await get_timetable(db, route.id, d)


async def get_timetable(
    db: AsyncSession, route_id: int, d: date
) -> dict | None:
    day = _day_type(d)
    cache_key = f"bus:timetable:{route_id}:{day}"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        return cached

    stmt = select(BusRoute).where(BusRoute.id == route_id)
    result = await db.execute(stmt)
    route = result.scalar_one_or_none()
    if not route:
        return None

    stmt = (
        select(BusTimetableEntry)
        .where(
            BusTimetableEntry.route_id == route_id,
            BusTimetableEntry.day_type == day,
        )
        .order_by(BusTimetableEntry.departure_time)
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()

    data = {
        "route_id": route.id,
        "route_name": route.route_name or route.route_number,
        "schedule_type": day,
        "times": [e.departure_time.strftime("%H:%M") for e in entries],
    }
    await set_cached_json(cache_key, data, ttl=86400)
    return data
