from datetime import date, datetime, time, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cached_json, set_cached_json
from app.models.subway import SubwayTimetableEntry

_TIMETABLE_TTL = 86400  # 24시간 — 시간표는 하루 단위로 갱신


def _day_type(d: date) -> str:
    wd = d.weekday()
    if wd < 5:
        return "weekday"
    return "sunday"


async def _load_entries(db: AsyncSession, day: str) -> list[dict]:
    """지하철 시간표 엔트리를 Redis 캐시에서 읽거나 DB에서 로드 후 캐시."""
    cache_key = f"subway:entries:{day}"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        return cached

    stmt = (
        select(SubwayTimetableEntry)
        .where(SubwayTimetableEntry.day_type == day)
        .order_by(SubwayTimetableEntry.departure_time)
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()

    data = [
        {
            "direction": e.direction,
            "departure_time": e.departure_time.strftime("%H:%M:%S"),
            "destination": e.destination or "",
            "updated_at": e.updated_at.isoformat() if e.updated_at else None,
        }
        for e in entries
    ]
    await set_cached_json(cache_key, data, ttl=_TIMETABLE_TTL)
    return data


async def get_timetable(
    db: AsyncSession, d: date, direction: str | None = None
) -> dict:
    day = _day_type(d)
    entries = await _load_entries(db, day)

    groups: dict[str, list[dict]] = {"up": [], "down": [], "line4_up": [], "line4_down": []}
    updated_at = None

    for e in entries:
        if direction and e["direction"] != direction:
            continue
        item = {"depart_at": e["departure_time"][:5], "destination": e["destination"]}
        if e["direction"] in groups:
            groups[e["direction"]].append(item)
        if e["updated_at"] and (updated_at is None or e["updated_at"] > updated_at):
            updated_at = e["updated_at"]

    return {
        "station": "정왕",
        "day_type": day,
        "updated_at": updated_at,
        "up": groups["up"],
        "down": groups["down"],
        "line4_up": groups["line4_up"],
        "line4_down": groups["line4_down"],
    }


async def get_next(db: AsyncSession, d: date, now_time: time) -> dict:
    day = _day_type(d)
    entries = await _load_entries(db, day)

    nexts: dict[str, dict | None] = {
        "up": None, "down": None, "line4_up": None, "line4_down": None,
    }

    now_str = now_time.strftime("%H:%M:%S")

    for e in entries:
        direction = e["direction"]
        if direction not in nexts or nexts[direction] is not None:
            continue
        if e["departure_time"] <= now_str:
            continue

        depart_dt = datetime.combine(d, time.fromisoformat(e["departure_time"]), tzinfo=timezone.utc)
        now_dt = datetime.combine(d, now_time, tzinfo=timezone.utc)
        diff = int((depart_dt - now_dt).total_seconds())

        nexts[direction] = {
            "depart_at": e["departure_time"][:5],
            "arrive_in_seconds": diff,
            "destination": e["destination"],
        }

        if all(v is not None for v in nexts.values()):
            break

    return nexts
