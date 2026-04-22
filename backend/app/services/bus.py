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


async def _compute_avg_interval(
    db: AsyncSession,
    route_id: int,
    stop_id: int,
    day_type: str,
    hour: int,
) -> int | None:
    """현재 시각 ±60분 윈도우의 bus_timetable_entries 기반 평균 배차 간격(분).

    entries 수 < 3이면 None 반환 (통계적으로 불충분).
    결과는 Redis에 TTL 3600으로 캐시. None은 캐시하지 않음 (다음 갱신 때 재계산).
    """
    if hour < 0 or hour > 23:
        return None

    cache_key = f"bus:interval:{route_id}:{stop_id}:{day_type}:{hour}"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        # 캐시는 {"value": int} 형태로 저장; 과거 int 저장 케이스도 방어
        if isinstance(cached, dict):
            val = cached.get("value")
            if isinstance(val, int):
                return val
        elif isinstance(cached, int):
            return cached

    # ±60분 윈도우: (hour-1)시 00분 ~ (hour+1)시 59분
    # 자정 경계는 clamp (자정 이후 entries는 다음날 day_type이라 이 윈도우에서 제외)
    lower_hour = max(0, hour - 1)
    upper_hour = min(23, hour + 1)
    lower_bound = time(lower_hour, 0, 0)
    upper_bound = time(upper_hour, 59, 59)

    stmt = (
        select(BusTimetableEntry.departure_time)
        .where(
            BusTimetableEntry.route_id == route_id,
            BusTimetableEntry.stop_id == stop_id,
            BusTimetableEntry.day_type == day_type,
            BusTimetableEntry.departure_time >= lower_bound,
            BusTimetableEntry.departure_time <= upper_bound,
        )
        .order_by(BusTimetableEntry.departure_time)
    )
    result = await db.execute(stmt)
    times: list[time] = list(result.scalars().all())

    if len(times) < 3:
        return None

    # 인접 간격(분) 계산
    gaps: list[float] = []
    for i in range(len(times) - 1):
        t1 = times[i]
        t2 = times[i + 1]
        sec1 = t1.hour * 3600 + t1.minute * 60 + t1.second
        sec2 = t2.hour * 3600 + t2.minute * 60 + t2.second
        diff_sec = sec2 - sec1
        if diff_sec <= 0:
            continue
        gaps.append(diff_sec / 60.0)

    if not gaps:
        return None

    avg_minutes = round(sum(gaps) / len(gaps))
    if avg_minutes <= 0:
        return None

    await set_cached_json(cache_key, {"value": avg_minutes}, ttl=3600)
    return avg_minutes


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
            "sub_name": s.sub_name,
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
    # 정류장 조회 — 먼저 gbis_station_id(외부 ID)로, 없으면 내부 PK(id)로 매칭
    # 프론트엔드는 GBIS 정류장 ID(예: 224000639)를 그대로 전달하므로 외부 ID 우선.
    stmt = (
        select(BusStop)
        .where(BusStop.gbis_station_id == str(station_id))
        .options(selectinload(BusStop.routes))
    )
    result = await db.execute(stmt)
    stop = result.scalar_one_or_none()
    if not stop:
        stmt = (
            select(BusStop)
            .where(BusStop.id == station_id)
            .options(selectinload(BusStop.routes))
        )
        result = await db.execute(stmt)
        stop = result.scalar_one_or_none()
    if not stop:
        return None

    # 내부 PK로 이후 쿼리를 수행 (시간표 JOIN 등은 stop.id 기준)
    station_id = stop.id

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
                payload = json.loads(cached)

                # 구형(리스트) 형태와 신형(dict with cached_at) 모두 지원
                if isinstance(payload, list):
                    cached_arrivals = payload
                    elapsed_sec = 0
                else:
                    cached_arrivals = payload.get("arrivals", [])
                    try:
                        cached_at = datetime.fromisoformat(payload["cached_at"])
                        # cached_at은 KST aware datetime — 현재 시각과 비교
                        now_kst = datetime.now(_KST)
                        if cached_at.tzinfo is None:
                            cached_at = cached_at.replace(tzinfo=_KST)
                        elapsed_sec = max(0, int((now_kst - cached_at).total_seconds()))
                    except (KeyError, ValueError):
                        elapsed_sec = 0

                # 노선별 avg_interval_minutes 캐시(동일 노선 중복 계산 방지)
                interval_cache: dict[int, int | None] = {}
                for arrival in cached_arrivals:
                    if elapsed_sec > 0 and arrival.get("arrive_in_seconds") is not None:
                        arrival["arrive_in_seconds"] = max(
                            0, arrival["arrive_in_seconds"] - elapsed_sec
                        )
                    route_id = arrival.get("route_id")
                    if isinstance(route_id, int):
                        if route_id not in interval_cache:
                            try:
                                interval_cache[route_id] = await _compute_avg_interval(
                                    db, route_id, stop.id, day, now_time.hour
                                )
                            except Exception as exc:
                                logger.warning(
                                    "avg_interval 계산 실패 (route %s, stop %s): %s",
                                    route_id, stop.id, exc,
                                )
                                interval_cache[route_id] = None
                        avg = interval_cache[route_id]
                        if avg is not None:
                            arrival["avg_interval_minutes"] = avg
                arrivals.extend(cached_arrivals)
        except Exception as exc:
            logger.warning("Redis 캐시 읽기 실패 (정류장 %s): %s", station_id, exc)

    # ── 1-1. GBIS 캐시에 없는 실시간 노선 → null placeholder ─────────────────
    # gbis_station_id가 없는 정류장은 실시간 조회 자체가 불가하므로 placeholder를 추가하지
    # 않고 시간표 쿼리로 넘긴다 (stop.gbis_station_id가 있을 때만 placeholder 적용).
    if stop.gbis_station_id:
        seen_realtime_ids: set[int] = {a["route_id"] for a in arrivals}
        for route in realtime_routes:
            if route.id not in seen_realtime_ids:
                arrivals.append({
                    "route_id": route.id,
                    "route_no": route.route_number,
                    "destination": route.direction_name,
                    "category": route.category,
                    "arrival_type": "realtime",
                    "depart_at": None,
                    "arrive_in_seconds": None,
                    "is_tomorrow": False,
                })

    # ── 2. 시간표 기반 노선: DB 조회 ───────────────────────────────────────
    # gbis_station_id 없는 정류장에서는 gbis_route_id를 가진 노선도 시간표로 조회한다.
    realtime_route_ids: set[int] = (
        {r.id for r in realtime_routes} if stop.gbis_station_id else set()
    )
    # 오늘 시간표 소진 판단 범위: gbis 없는 정류장은 모든 노선을 시간표 대상으로 간주
    timetable_route_ids: set[int] = (
        {r.id for r in stop.routes if not r.is_realtime}
        if stop.gbis_station_id
        else {r.id for r in stop.routes}
    )

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
            "category": route.category,
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
                "category": route.category,
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
    db: AsyncSession, route_number: str, d: date, *, stop_id: int | None = None
) -> dict | None:
    """route_number(예: "3400") 문자열로 조회. ID를 모를 때 사용.
    같은 route_number에 여러 row가 있을 때(양방향 분리) stop_id로 실제 시간표가 있는
    row를 찾아 사용한다. stop_id가 없거나 단일 row면 첫 번째 row를 사용한다."""
    stmt = select(BusRoute).where(BusRoute.route_number == route_number).order_by(BusRoute.id)
    result = await db.execute(stmt)
    routes = result.scalars().all()
    if not routes:
        return None

    if stop_id is not None and len(routes) > 1:
        # 여러 row 중 해당 stop에 실제 시간표 데이터가 있는 row를 우선 선택
        day = _day_type(d)
        for route in routes:
            check_stmt = (
                select(BusTimetableEntry.id)
                .where(
                    BusTimetableEntry.route_id == route.id,
                    BusTimetableEntry.stop_id == stop_id,
                    BusTimetableEntry.day_type == day,
                )
                .limit(1)
            )
            exists = (await db.execute(check_stmt)).scalar_one_or_none()
            if exists is not None:
                return await get_timetable(db, route.id, d, stop_id=stop_id)

    return await get_timetable(db, routes[0].id, d, stop_id=stop_id)


async def get_timetable(
    db: AsyncSession, route_id: int, d: date, *, stop_id: int | None = None
) -> dict | None:
    day = _day_type(d)
    cache_key = f"bus:timetable:{route_id}:{day}:{stop_id if stop_id is not None else 'all'}"
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
    if stop_id is not None:
        stmt = stmt.where(BusTimetableEntry.stop_id == stop_id)
    result = await db.execute(stmt)
    entries = result.scalars().all()

    stop_name: str | None = None
    if stop_id is not None:
        stop = await db.get(BusStop, stop_id)
        stop_name = stop.name if stop else None

    data = {
        "route_id": route.id,
        "route_name": route.route_name or route.route_number,
        "schedule_type": day,
        "stop_id": stop_id,
        "stop_name": stop_name,
        "times": [e.departure_time.strftime("%H:%M") for e in entries],
        "notes": [e.note for e in entries],
    }
    await set_cached_json(cache_key, data, ttl=86400)
    return data
