from datetime import date, datetime, time, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subway import SubwayTimetableEntry


def _day_type(d: date) -> str:
    wd = d.weekday()
    if wd < 5:
        return "weekday"
    # 토요일·일요일 모두 sunday (TAGO API가 토요일 데이터 미제공)
    return "sunday"


async def get_timetable(
    db: AsyncSession, d: date, direction: str | None = None
) -> dict:
    day = _day_type(d)

    stmt = (
        select(SubwayTimetableEntry)
        .where(SubwayTimetableEntry.day_type == day)
        .order_by(SubwayTimetableEntry.departure_time)
    )
    if direction:
        stmt = stmt.where(SubwayTimetableEntry.direction == direction)

    result = await db.execute(stmt)
    entries = result.scalars().all()

    groups: dict[str, list[dict]] = {"up": [], "down": [], "line4_up": [], "line4_down": []}
    updated_at = None

    for e in entries:
        item = {
            "depart_at": e.departure_time.strftime("%H:%M"),
            "destination": e.destination or "",
        }
        if e.direction in groups:
            groups[e.direction].append(item)
        if e.updated_at and (updated_at is None or e.updated_at > updated_at):
            updated_at = e.updated_at

    return {
        "station": "정왕",
        "day_type": day,
        "updated_at": updated_at.isoformat() if updated_at else None,
        "up": groups["up"],
        "down": groups["down"],
        "line4_up": groups["line4_up"],
        "line4_down": groups["line4_down"],
    }


async def get_next(db: AsyncSession, d: date, now_time: time) -> dict:
    day = _day_type(d)

    stmt = (
        select(SubwayTimetableEntry)
        .where(
            SubwayTimetableEntry.day_type == day,
            SubwayTimetableEntry.departure_time > now_time,
        )
        .order_by(SubwayTimetableEntry.departure_time)
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()

    nexts: dict[str, dict | None] = {
        "up": None, "down": None, "line4_up": None, "line4_down": None,
    }

    for e in entries:
        if nexts.get(e.direction) is not None:
            continue

        now_dt = datetime.combine(d, now_time, tzinfo=timezone.utc)
        depart_dt = datetime.combine(d, e.departure_time, tzinfo=timezone.utc)
        diff = int((depart_dt - now_dt).total_seconds())

        nexts[e.direction] = {
            "depart_at": e.departure_time.strftime("%H:%M"),
            "arrive_in_seconds": diff,
            "destination": e.destination or "",
        }

        if all(v is not None for v in nexts.values()):
            break

    return nexts
