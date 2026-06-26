from datetime import date, datetime, time, timedelta

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import delete_keys, get_cached_json, set_cached_json
from app.core.calendar import get_day_type, get_holiday_name, is_holiday
from app.models.shuttle import SchedulePeriod, ShuttleRoute, ShuttleTimetableEntry

_PERIOD_TTL = 3600       # 1시간 — 운행 기간은 자주 안 바뀜
_PERIOD_MISS_TTL = 300   # 5분 — '운행기간 없음' 네거티브 캐시는 짧게.
                         # 방학 중 새 period(계절학기 등)를 추가해도 곧 자가회복되게.
                         # (mistakes.md §5 — 네거티브 캐시 TTL이 길면 추가가 몇 시간 안 보였음.)
_SCHEDULE_TTL = 3600     # 1시간
_ENTRIES_TTL = 3600      # 1시간


async def _load_period(db: AsyncSession, d: date) -> dict | None:
    """현재 운행 기간을 Redis 캐시에서 읽거나 DB에서 로드 후 캐시."""
    cache_key = f"shuttle:period:{d.isoformat()}"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        return cached if cached.get("id") else None

    stmt = (
        select(SchedulePeriod)
        .where(SchedulePeriod.start_date <= d, SchedulePeriod.end_date >= d)
        .order_by(SchedulePeriod.priority.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    period = result.scalar_one_or_none()

    if not period:
        await set_cached_json(cache_key, {}, ttl=_PERIOD_MISS_TTL)
        return None

    data = {
        "id": period.id,
        "period_type": period.period_type,
        "name": period.name,
        "start_date": period.start_date.isoformat(),
        "end_date": period.end_date.isoformat(),
    }
    await set_cached_json(cache_key, data, ttl=_PERIOD_TTL)
    return data


async def _load_entries(db: AsyncSession, period_id: int, day: str) -> list[dict]:
    """셔틀 시간표 엔트리를 Redis 캐시에서 읽거나 DB에서 로드 후 캐시."""
    cache_key = f"shuttle:entries:{period_id}:{day}"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        return cached

    stmt = (
        select(ShuttleTimetableEntry, ShuttleRoute)
        .join(ShuttleRoute, ShuttleTimetableEntry.shuttle_route_id == ShuttleRoute.id)
        .where(
            ShuttleTimetableEntry.schedule_period_id == period_id,
            ShuttleTimetableEntry.day_type == day,
        )
        .order_by(ShuttleTimetableEntry.departure_time)
    )
    result = await db.execute(stmt)
    rows = result.all()

    data = [
        {
            "direction": route.direction,
            "departure_time": entry.departure_time.strftime("%H:%M:%S"),
            "note": entry.note,
        }
        for entry, route in rows
    ]
    if data:  # 빈 리스트는 캐시하지 않음 — 데이터 삽입 전 캐시로 인한 오탐 방지
        await set_cached_json(cache_key, data, ttl=_ENTRIES_TTL)
    return data


async def get_current_period(db: AsyncSession, d: date) -> SchedulePeriod | None:
    """하위호환용 — 내부적으로 캐시된 _load_period 사용."""
    return await _load_period(db, d)


async def invalidate_shuttle_cache() -> int:
    """셔틀 운행기간/시간표 Redis 캐시를 모두 무효화한다. 삭제 키 수 반환.

    schedule_periods·shuttle_timetable_entries 변경(마이그레이션·시드) 후,
    또는 재배포 startup에서 호출한다. 방학 중 캐시된 'period 없음'(네거티브 캐시)이
    새로 추가된 기간을 가리지 않도록 정리한다.
    """
    cleared = await delete_keys("shuttle:period:*")
    cleared += await delete_keys("shuttle:entries:*")
    return cleared


async def get_schedule(
    db: AsyncSession, d: date, direction: int | None = None
) -> dict | None:
    period = await _load_period(db, d)
    if not period:
        return None

    day = get_day_type(d)
    entries = await _load_entries(db, period["id"], day)

    directions_map: dict[int, list[dict]] = {}
    for e in entries:
        dir_key = e["direction"]
        if direction is not None and dir_key != direction:
            continue
        if dir_key not in directions_map:
            directions_map[dir_key] = []
        directions_map[dir_key].append({"depart_at": e["departure_time"][:5], "note": e["note"]})

    return {
        "schedule_type": period["period_type"],
        "schedule_name": period["name"],
        "valid_from": period["start_date"],
        "valid_until": period["end_date"],
        "is_holiday": is_holiday(d),
        "holiday_name": get_holiday_name(d),
        "directions": [
            {"direction": dir_key, "times": times}
            for dir_key, times in directions_map.items()
        ],
    }


async def get_next(
    db: AsyncSession, d: date, now_time: time, direction: int | None = None
) -> dict | None:
    period = await _load_period(db, d)
    if not period:
        return None

    day = get_day_type(d)
    entries = await _load_entries(db, period["id"], day)

    now_str = now_time.strftime("%H:%M:%S")
    future = [
        e for e in entries
        if e["departure_time"] > now_str
        and (direction is None or e["direction"] == direction)
    ]

    if not future:
        return None

    e = future[0]
    now_dt = datetime.combine(d, now_time)
    depart_dt = datetime.combine(d, time.fromisoformat(e["departure_time"]))
    diff = int((depart_dt - now_dt).total_seconds())

    next_depart_at: str | None = None
    next_arrive_in_seconds: int | None = None
    if len(future) >= 2:
        e2 = future[1]
        depart_dt2 = datetime.combine(d, time.fromisoformat(e2["departure_time"]))
        next_diff = int((depart_dt2 - now_dt).total_seconds())
        next_depart_at = e2["departure_time"][:8]
        next_arrive_in_seconds = next_diff

    return {
        "direction": e["direction"],
        "depart_at": e["departure_time"][:8],
        "arrive_in_seconds": diff,
        "is_last": len(future) == 1,
        "note": e["note"],
        "next_depart_at": next_depart_at,
        "next_arrive_in_seconds": next_arrive_in_seconds,
    }


async def get_semester_schedule(
    db: AsyncSession, direction: int | None = None
) -> dict | None:
    """현재 날짜 기준 가장 가까운 SEMESTER 기간(현재 진행 중이거나 미래)을 찾아
    해당 기간의 평일(weekday) 시간표를 반환한다.
    없으면 직전 SEMESTER를 사용한다.
    """
    today = datetime.now().date()

    # 가장 가까운 SEMESTER 기간 조회: 오늘 이후(또는 현재 진행 중) → 없으면 직전
    stmt_future = (
        select(SchedulePeriod)
        .where(
            and_(
                SchedulePeriod.period_type == "SEMESTER",
                SchedulePeriod.end_date >= today,
            )
        )
        .order_by(SchedulePeriod.start_date.asc())
        .limit(1)
    )
    result = await db.execute(stmt_future)
    period = result.scalar_one_or_none()

    if not period:
        # 직전 SEMESTER 사용
        stmt_past = (
            select(SchedulePeriod)
            .where(SchedulePeriod.period_type == "SEMESTER")
            .order_by(SchedulePeriod.end_date.desc())
            .limit(1)
        )
        result = await db.execute(stmt_past)
        period = result.scalar_one_or_none()

    if not period:
        return None

    period_data = {
        "id": period.id,
        "period_type": period.period_type,
        "name": period.name,
        "start_date": period.start_date.isoformat(),
        "end_date": period.end_date.isoformat(),
    }

    entries = await _load_entries(db, period_data["id"], "weekday")

    directions_map: dict[int, list[dict]] = {}
    for e in entries:
        dir_key = e["direction"]
        if direction is not None and dir_key != direction:
            continue
        if dir_key not in directions_map:
            directions_map[dir_key] = []
        directions_map[dir_key].append({"depart_at": e["departure_time"][:5], "note": e["note"]})

    return {
        "schedule_type": period_data["period_type"],
        "schedule_name": period_data["name"],
        "valid_from": period_data["start_date"],
        "valid_until": period_data["end_date"],
        "is_holiday": False,
        "holiday_name": None,
        "directions": [
            {"direction": dir_key, "times": times}
            for dir_key, times in directions_map.items()
        ],
    }
