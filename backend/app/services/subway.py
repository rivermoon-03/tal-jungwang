from datetime import date, datetime, time, timezone

import httpx
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cached_json, get_redis, set_cached_json
from app.core.config import settings
from app.models.subway import SubwayTimetableEntry

_TIMETABLE_TTL = 43200  # 12시간 — 시간표는 하루 단위로 갱신


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

    groups: dict[str, list[dict]] = {
        "up": [], "down": [], "line4_up": [], "line4_down": [],
        "choji_up": [], "choji_dn": [], "siheung_up": [], "siheung_dn": [],
    }
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
        "choji_up": groups["choji_up"],
        "choji_dn": groups["choji_dn"],
        "siheung_up": groups["siheung_up"],
        "siheung_dn": groups["siheung_dn"],
    }


async def get_next(db: AsyncSession, d: date, now_time: time) -> dict:
    day = _day_type(d)
    entries = await _load_entries(db, day)

    directions = (
        "up", "down", "line4_up", "line4_down",
        "choji_up", "choji_dn", "siheung_up", "siheung_dn",
    )
    # 방향당 최대 2건(첫 번째 + 다음 다음) 모은다.
    buckets: dict[str, list[dict]] = {k: [] for k in directions}

    now_str = now_time.strftime("%H:%M:%S")
    now_dt = datetime.combine(d, now_time, tzinfo=timezone.utc)

    for e in entries:
        direction = e["direction"]
        if direction not in buckets:
            continue
        if len(buckets[direction]) >= 2:
            continue
        if e["departure_time"] <= now_str:
            continue

        depart_dt = datetime.combine(d, time.fromisoformat(e["departure_time"]), tzinfo=timezone.utc)
        diff = int((depart_dt - now_dt).total_seconds())

        buckets[direction].append({
            "depart_at": e["departure_time"][:5],
            "arrive_in_seconds": diff,
            "destination": e["destination"],
        })

        # 모든 방향이 2건씩 채워지면 조기 종료
        if all(len(v) >= 2 for v in buckets.values()):
            break

    nexts: dict[str, dict | None] = {}
    for direction in directions:
        items = buckets[direction]
        if not items:
            nexts[direction] = None
            continue
        first = items[0]
        second = items[1] if len(items) >= 2 else None
        nexts[direction] = {
            "depart_at": first["depart_at"],
            "arrive_in_seconds": first["arrive_in_seconds"],
            "destination": first["destination"],
            "next_depart_at": second["depart_at"] if second else None,
            "next_arrive_in_seconds": second["arrive_in_seconds"] if second else None,
        }

    return nexts


# ── TAGO API 상수 ─────────────────────────────────────────────
_TAGO_BASE = "https://apis.data.go.kr/1613000/SubwayInfo/GetSubwaySttnAcctoSchdulList"
_SUINBUNDANG_ID = "MTRKRK1K257"
_LINE4_ID = "MTRKR4455"
_CHOJI_ID = "MTRSWWSS26"      # 초지역 서해선
_SIHEUNG_ID = "MTRSWWSS22"    # 시흥시청역 서해선
_SUBWAY_COMBOS = [
    (_SUINBUNDANG_ID, "01", "U", "weekday", "up"),
    (_SUINBUNDANG_ID, "01", "D", "weekday", "down"),
    (_SUINBUNDANG_ID, "03", "U", "sunday",  "up"),
    (_SUINBUNDANG_ID, "03", "D", "sunday",  "down"),
    (_LINE4_ID,       "01", "U", "weekday", "line4_up"),
    (_LINE4_ID,       "01", "D", "weekday", "line4_down"),
    (_LINE4_ID,       "03", "U", "sunday",  "line4_up"),
    (_LINE4_ID,       "03", "D", "sunday",  "line4_down"),
    (_CHOJI_ID,       "01", "U", "weekday", "choji_up"),
    (_CHOJI_ID,       "01", "D", "weekday", "choji_dn"),
    (_CHOJI_ID,       "03", "U", "sunday",  "choji_up"),
    (_CHOJI_ID,       "03", "D", "sunday",  "choji_dn"),
    (_SIHEUNG_ID,     "01", "U", "weekday", "siheung_up"),
    (_SIHEUNG_ID,     "01", "D", "weekday", "siheung_dn"),
    (_SIHEUNG_ID,     "03", "U", "sunday",  "siheung_up"),
    (_SIHEUNG_ID,     "03", "D", "sunday",  "siheung_dn"),
]


async def refresh_timetable(db: AsyncSession) -> int:
    """TAGO API에서 정왕역 시간표를 새로 가져와 DB + Redis 캐시를 갱신한다.

    Returns:
        삽입된 행 수
    """
    now = datetime.now(timezone.utc)
    total = 0

    async with httpx.AsyncClient() as client:
        await db.execute(delete(SubwayTimetableEntry))

        for station_id, daily_code, ud_code, day_type, direction in _SUBWAY_COMBOS:
            params = {
                "serviceKey": settings.DATA_GO_KR_SERVICE_KEY,
                "subwayStationId": station_id,
                "dailyTypeCode": daily_code,
                "upDownTypeCode": ud_code,
                "numOfRows": 500,
                "_type": "json",
            }
            resp = await client.get(_TAGO_BASE, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
            if isinstance(items, dict):
                items = [items]

            for item in items:
                dep_str = item.get("depTime", "")
                if not dep_str or len(dep_str) < 6:
                    continue
                hh, mm, ss = int(dep_str[:2]), int(dep_str[2:4]), int(dep_str[4:6])
                dest = item.get("endSubwayStationNm", "") or ""
                if not dest and direction == "line4_up":
                    dest = "당고개"
                if not dest and direction in ("choji_up", "siheung_up"):
                    dest = "대곡"
                db.add(SubwayTimetableEntry(
                    direction=direction,
                    day_type=day_type,
                    departure_time=time(hh, mm, ss),
                    destination=dest,
                    updated_at=now,
                ))
                total += 1

        await db.commit()

    redis = await get_redis()
    for day in ("weekday", "saturday", "sunday"):
        await redis.delete(f"subway:entries:{day}")

    return total


async def needs_refresh(db: AsyncSession) -> bool:
    """DB에 지하철 시간표 데이터가 없으면 True."""
    result = await db.execute(select(func.count()).select_from(SubwayTimetableEntry))
    return (result.scalar() or 0) == 0
