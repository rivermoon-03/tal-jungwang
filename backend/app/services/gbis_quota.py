"""GBIS 일일 호출 한도 감시.

응답 헤더 X-RateLimit-Remaining 이 1000 이하로 내려가면 100 단위(1000, 900, ..., 0)마다 한 번씩 Discord 로 알린다.
같은 날 같은 단계는 Redis 로 한 번만 보낸다(서버가 여러 대여도 중복되지 않는다).
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.cache import get_redis

logger = logging.getLogger(__name__)
_KST = ZoneInfo("Asia/Seoul")

ALERT_FROM = 1000
STEP = 100


def alert_level(remaining: int | None) -> int | None:
    """알림 단계. 1000 이하일 때 남은 횟수를 100 단위로 올림한 값(950 → 1000, 900 → 900, 0 → 0)."""
    if remaining is None or remaining > ALERT_FROM:
        return None
    return -(-max(remaining, 0) // STEP) * STEP


def _int_header(headers, name: str) -> int | None:
    try:
        return int(headers.get(name))
    except (TypeError, ValueError):
        return None


async def check_quota(headers, api: str) -> None:
    """GBIS 응답 헤더를 보고 필요하면 알린다. 실패해도 호출한 쪽에는 영향을 주지 않는다."""
    remaining = _int_header(headers, "X-RateLimit-Remaining")
    level = alert_level(remaining)
    if level is None:
        return
    try:
        redis = await get_redis()
        today = datetime.now(_KST).strftime("%Y%m%d")
        first = await redis.set(f"gbis:quota_alert:{api}:{today}:{level}", "1", nx=True, ex=2 * 86400)
        if not first:
            return
        limit = _int_header(headers, "X-RateLimit-Limit")
        from app.services.bus_monitor import _post

        await _post(f"[GBIS 한도] {api} 일일 호출 남은 {remaining}회 / 한도 {limit if limit is not None else '?'}회")
    except Exception:
        logger.warning("GBIS 한도 알림 실패 (%s, 남은 %s)", api, remaining, exc_info=True)
