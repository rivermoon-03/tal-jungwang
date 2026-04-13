from datetime import date, datetime, time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shuttle import SchedulePeriod, ShuttleRoute, ShuttleTimetableEntry


def _day_type(d: date) -> str:
    wd = d.weekday()
    if wd < 5:
        return "weekday"
    if wd == 5:
        return "saturday"
    return "sunday"


async def get_current_period(db: AsyncSession, d: date) -> SchedulePeriod | None:
    stmt = (
        select(SchedulePeriod)
        .where(SchedulePeriod.start_date <= d, SchedulePeriod.end_date >= d)
        .order_by(SchedulePeriod.priority.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_schedule(
    db: AsyncSession, d: date, direction: str | None = None
) -> dict | None:
    period = await get_current_period(db, d)
    if not period:
        return None

    day = _day_type(d)

    stmt = (
        select(ShuttleTimetableEntry, ShuttleRoute)
        .join(ShuttleRoute, ShuttleTimetableEntry.shuttle_route_id == ShuttleRoute.id)
        .where(
            ShuttleTimetableEntry.schedule_period_id == period.id,
            ShuttleTimetableEntry.day_type == day,
        )
        .order_by(ShuttleTimetableEntry.departure_time)
    )
    if direction:
        stmt = stmt.where(ShuttleRoute.route_name.ilike(f"%{direction}%"))

    result = await db.execute(stmt)
    rows = result.all()

    directions_map: dict[str, list[dict]] = {}
    for entry, route in rows:
        name = route.route_name
        if name not in directions_map:
            directions_map[name] = []
        directions_map[name].append({
            "depart_at": entry.departure_time.strftime("%H:%M"),
            "note": entry.note,
        })

    return {
        "schedule_type": period.period_type,
        "schedule_name": period.name,
        "valid_from": period.start_date.isoformat(),
        "valid_until": period.end_date.isoformat(),
        "directions": [
            {"direction": d, "times": times}
            for d, times in directions_map.items()
        ],
    }


async def get_next(
    db: AsyncSession, d: date, now_time: time, direction: str | None = None
) -> dict | None:
    period = await get_current_period(db, d)
    if not period:
        return None

    day = _day_type(d)

    stmt = (
        select(ShuttleTimetableEntry, ShuttleRoute)
        .join(ShuttleRoute, ShuttleTimetableEntry.shuttle_route_id == ShuttleRoute.id)
        .where(
            ShuttleTimetableEntry.schedule_period_id == period.id,
            ShuttleTimetableEntry.day_type == day,
            ShuttleTimetableEntry.departure_time > now_time,
        )
        .order_by(ShuttleTimetableEntry.departure_time)
    )
    if direction:
        stmt = stmt.where(ShuttleRoute.route_name.ilike(f"%{direction}%"))

    result = await db.execute(stmt)
    rows = result.all()

    if not rows:
        return None

    entry, route = rows[0]
    now_dt = datetime.combine(d, now_time)
    depart_dt = datetime.combine(d, entry.departure_time)
    diff = int((depart_dt - now_dt).total_seconds())

    # Check if this is the last one
    is_last = len(rows) == 1

    return {
        "direction": route.route_name,
        "depart_at": entry.departure_time.strftime("%H:%M:%S"),
        "arrive_in_seconds": diff,
        "is_last": is_last,
        "note": entry.note,
    }
