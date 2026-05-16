from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cached_json, get_redis, set_cached_json
from app.core.calendar import get_day_type, get_holiday_name, is_holiday
from app.core.config import settings
from app.models.subway import SubwayTimetableEntry

_TIMETABLE_TTL = 43200  # 12시간 — 시간표는 하루 단위로 갱신
_KST = ZoneInfo("Asia/Seoul")


def _subway_day_type(d: date) -> str:
    """지하철 시간표용 day_type 매핑.

    subway_timetable_entries 시드는 weekday/sunday 만 존재하고 saturday 행이 0건이라,
    토요일도 sunday 시간표를 그대로 사용한다 (운영 합의된 quirk).
    공용 ``get_day_type`` 은 표준 매핑(saturday → "saturday") 을 유지하고,
    이 헬퍼에서만 saturday → sunday 로 다시 매핑한다.
    """
    day = get_day_type(d)
    return "sunday" if day == "saturday" else day


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
    day = _subway_day_type(d)
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
        "is_holiday": is_holiday(d),
        "holiday_name": get_holiday_name(d),
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
    """현재(KST) 시각 기준 각 방향의 다음 1·2번째 열차를 반환.

    자정 후 첫 운행 열차(예: 00:01) 가 23시대 사용자에게 보이지 않던 버그 수정:
      - 시간대를 KST 로 명시 (이전엔 UTC 부여, KST 입력 시각과 mismatch).
      - 문자열 사전순 비교 (`"23:55" <= "00:01"`) 제거 — 자정 wraparound 미고려.
      - 늦은 밤(20시 이후)에 조회한 새벽(4시 이전) 출발은 다음날로 보정.
      - 자정 보정 후 entries 순서가 깨질 수 있으므로 후보를 전부 모은 뒤
        diff 오름차순으로 정렬해 방향별 첫 2개 선택.
    """
    day = _subway_day_type(d)
    entries = await _load_entries(db, day)

    directions = (
        "up", "down", "line4_up", "line4_down",
        "choji_up", "choji_dn", "siheung_up", "siheung_dn",
    )
    now_dt = datetime.combine(d, now_time, tzinfo=_KST)

    # 방향별 후보 (diff_sec, depart_at, destination) 수집 후 정렬.
    candidates: dict[str, list[tuple[int, str, str]]] = {k: [] for k in directions}

    for e in entries:
        direction = e["direction"]
        if direction not in candidates:
            continue

        dep_time = time.fromisoformat(e["departure_time"])
        depart_dt = datetime.combine(d, dep_time, tzinfo=_KST)
        # 자정 후 출발(예: 00:01)이고 현재가 늦은 밤(>=20시)이면 다음날로 보정.
        if dep_time.hour < 4 and now_time.hour >= 20:
            depart_dt += timedelta(days=1)

        diff_sec = int((depart_dt - now_dt).total_seconds())
        if diff_sec <= 0:
            continue

        candidates[direction].append(
            (diff_sec, e["departure_time"][:5], e["destination"])
        )

    nexts: dict[str, dict | None] = {}
    for direction in directions:
        items = sorted(candidates[direction], key=lambda x: x[0])[:2]
        if not items:
            nexts[direction] = None
            continue
        first = items[0]
        second = items[1] if len(items) >= 2 else None
        nexts[direction] = {
            "depart_at": first[1],
            "arrive_in_seconds": first[0],
            "destination": first[2],
            "next_depart_at": second[1] if second else None,
            "next_arrive_in_seconds": second[0] if second else None,
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
