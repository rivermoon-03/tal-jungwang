"""정적·준정적 데이터를 Redis에 미리 적재(cache warming).

cache-aside 항목들을 사용자 요청 *전에* 채워 첫 요청의 cold miss를 없앤다.

호출 시점은 두 가지다.
- startup: ``main.py`` lifespan에서 1회 (재배포·재시작 직후 첫 사용자 보호).
- 주기 재적재: 스케줄러가 TTL 만료 *전에* 다시 채운다.
  (mistakes.md §5 — 재적재 간격 ≤ TTL 이 되게 해서 만료 순간의 cold miss를 없앤다.)

각 항목은 try/except로 격리되어, 하나가 실패해도 나머지는 계속 적재한다.
모든 service 함수가 cache-aside(미스 시 set)라, 단순히 호출만 해도 캐시가 채워진다.
"""

import logging
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bus import BusTimetableEntry

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")


def _kst_today() -> date:
    """워밍 대상 날짜는 항상 KST 기준으로 잡는다 (mistakes.md §1 — tz-aware)."""
    return datetime.now(_KST).date()


async def warm_bus_timetables(db: AsyncSession) -> int:
    """오늘 day_type의 (route_id, stop_id) 조합 버스 시간표를 Redis에 적재.

    버스 시간표는 ``bus:timetable:{route_id}:{day}:{stop_id|'all'}`` 키로 TTL 24h
    cache-aside 캐시된다. startup 워밍이 없어서 재배포·재시작 직후 첫 사용자가
    조합마다 cold DB miss를 맞았다. 실제로 존재하는 조합만 골라 미리 채운다.

    Returns: 적재한 캐시 키 수.
    """
    from app.services.bus import _day_type, get_timetable

    today = _kst_today()
    day = _day_type(today)

    # 오늘 day_type에 실제 시간표 entry가 있는 (route, stop) 조합만 추린다.
    stmt = (
        select(BusTimetableEntry.route_id, BusTimetableEntry.stop_id)
        .where(BusTimetableEntry.day_type == day)
        .distinct()
    )
    rows = (await db.execute(stmt)).all()

    warmed = 0
    route_ids: set[int] = set()
    for route_id, stop_id in rows:
        route_ids.add(route_id)
        try:
            await get_timetable(db, route_id, today, stop_id=stop_id)
            warmed += 1
        except Exception:
            logger.exception(
                "버스 시간표 워밍 실패 (route=%s, stop=%s)", route_id, stop_id
            )

    # 정류장 미지정(stop_id='all') 변형도 노선별로 적재 (노선 상세 화면 등).
    for route_id in route_ids:
        try:
            await get_timetable(db, route_id, today)
            warmed += 1
        except Exception:
            logger.exception("버스 시간표(all) 워밍 실패 (route=%s)", route_id)

    return warmed


async def warm_static(db: AsyncSession) -> dict[str, object]:
    """DB 기반 정적/준정적 캐시를 한 곳에서 적재.

    각 항목은 격리되어 하나가 실패해도 나머지는 진행한다.
    startup과 주기 재적재 양쪽에서 호출한다.

    Returns: 항목별 결과 요약 dict (로깅/관측용).
    """
    from app.services.map_markers import get_markers
    from app.services.shuttle import get_schedule
    from app.services.subway import get_timetable as subway_timetable

    today = _kst_today()
    summary: dict[str, object] = {}

    # 셔틀 운행기간·시간표 (TTL 1h)
    try:
        await get_schedule(db, today, None)
        summary["shuttle"] = "ok"
    except Exception:
        logger.exception("셔틀 캐시 워밍 실패")
        summary["shuttle"] = "error"

    # 지하철 시간표 (TTL 12h)
    try:
        await subway_timetable(db, today)
        summary["subway"] = "ok"
    except Exception:
        logger.exception("지하철 시간표 캐시 워밍 실패")
        summary["subway"] = "error"

    # 지도 마커 (TTL 24h)
    try:
        await get_markers(db)
        summary["markers"] = "ok"
    except Exception:
        logger.exception("지도 마커 캐시 워밍 실패")
        summary["markers"] = "error"

    # 버스 시간표 (TTL 24h) — 기존에 startup 워밍이 없던 빈틈.
    try:
        summary["bus_timetables"] = await warm_bus_timetables(db)
    except Exception:
        logger.exception("버스 시간표 캐시 워밍 실패")
        summary["bus_timetables"] = "error"

    logger.info("정적 캐시 워밍 완료: %s", summary)
    return summary
