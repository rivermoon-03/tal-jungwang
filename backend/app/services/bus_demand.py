"""밤 시간대 버스 폴링을 사용자 요청이 있는 정류장으로만 줄인다.

/bus/arrivals 요청이 오면 그 정류장에 2분짜리 요청 표시를 남긴다.
밤 구간(settings.BUS_ON_DEMAND_START ~ BUS_ON_DEMAND_END)에는 수집기가 표시가 남아 있는 정류장만 GBIS 에 묻는다.
"""

import logging
from datetime import datetime, time

from app.core.cache import get_redis

logger = logging.getLogger(__name__)

# 프런트는 화면을 보는 동안 30초마다 다시 묻는다. 두 번 놓쳐도 표시가 살아 있게 2분.
DEMAND_TTL = 120


def _key(station_id: str | int) -> str:
    return f"bus:demand:{station_id}"


def _parse_hhmm(value: str) -> time:
    h, m = value.split(":")
    return time(int(h), int(m))


def in_on_demand_window(now: datetime, start: str, end: str) -> bool:
    """now 가 [start, end) 안인지. end 가 start 보다 이르면 자정을 넘기는 구간이다."""
    t = now.time()
    s, e = _parse_hhmm(start), _parse_hhmm(end)
    if s <= e:
        return s <= t < e
    return t >= s or t < e


async def mark_demand(station_id: str | int) -> None:
    try:
        redis = await get_redis()
        await redis.set(_key(station_id), "1", ex=DEMAND_TTL)
    except Exception:
        # 표시를 못 남겨도 도착 응답은 그대로 나가야 한다. 밤에 그 정류장 갱신이 한 번 늦을 뿐이다.
        logger.warning("버스 요청 표시 실패 (정류장 %s)", station_id, exc_info=True)


async def demanded_ids(ids: list[str]) -> set[str]:
    """ids 중 요청 표시가 남아 있는 것"""
    if not ids:
        return set()
    redis = await get_redis()
    values = await redis.mget([_key(i) for i in ids])
    return {i for i, v in zip(ids, values) if v}
