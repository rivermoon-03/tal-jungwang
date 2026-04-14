from datetime import date, datetime, time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cached_json, set_cached_json
from app.models.shuttle import SchedulePeriod, ShuttleRoute, ShuttleTimetableEntry

_PERIOD_TTL = 3600       # 1시간 — 운행 기간은 자주 안 바뀜
_SCHEDULE_TTL = 3600     # 1시간
_ENTRIES_TTL = 3600      # 1시간


def _day_type(d: date) -> str:
    wd = d.weekday()
    if wd < 5:
        return "weekday"
    if wd == 5:
        return "saturday"
    return "sunday"


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
        await set_cached_json(cache_key, {}, ttl=_PERIOD_TTL)
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


async def get_schedule(
    db: AsyncSession, d: date, direction: int | None = None
) -> dict | None:
    period = await _load_period(db, d)
    if not period:
        return None

    day = _day_type(d)
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

    day = _day_type(d)
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
    depart_dt = datetime.combine(d, time.fromisoformat(e["departure_time"]))
    now_dt = datetime.combine(d, now_time)
    diff = int((depart_dt - now_dt).total_seconds())

    return {
        "direction": e["direction"],
        "depart_at": e["departure_time"][:8],
        "arrive_in_seconds": diff,
        "is_last": len(future) == 1,
        "note": e["note"],
    }
