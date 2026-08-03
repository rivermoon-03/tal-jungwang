"""통학축 돌발상황(사고·공사) 서비스 — B3.

cache-aside다: 스케줄러 잡 없이 요청 경로가 직접 캐시를 채운다(요청 트리거 +
single-flight). 캐시가 비면 그 요청이 ITS를 호출해 자가회복하므로 TTL은 stale
상한일 뿐이다(docs/cache-lifetimes.md의 cache-aside 분류).

빈 결과·어댑터 저하(None)도 짧게 음성 캐시한다 — 활용신청 미승인/장애 상태에서
홈 버스 패널 폴링(5분)마다 외부 API를 두드리지 않게 하면서, 승인·복구 후에는
최대 10분 안에 자동으로 살아난다.
"""

import logging

from app.core.cache import get_or_fetch_with_lock
from app.services.external.its import fetch_incidents

logger = logging.getLogger(__name__)

INCIDENTS_CACHE_KEY = "traffic:incidents"
INCIDENTS_CACHE_TTL = 1200        # 20분 — 돌발상황 확인 주기로 충분 (HTTP max-age 300과 계층 구분)
INCIDENTS_CACHE_TTL_EMPTY = 600   # 10분 — 빈 결과·저하 음성 캐시 (짧게 잡아 복구를 빨리 반영)


async def get_incidents() -> list[dict]:
    """통학축 돌발상황 목록. 어댑터 저하 시 빈 목록으로 조용히 저하된다."""

    async def _fetch() -> list[dict]:
        # None(실패·미승인)도 빈 목록으로 캐시한다 — 프런트는 빈 목록이면 아무것도
        # 그리지 않으므로 저하와 "돌발 없음"을 구분할 필요가 없다.
        return await fetch_incidents() or []

    return await get_or_fetch_with_lock(
        INCIDENTS_CACHE_KEY,
        # 결과 유무에 따라 TTL을 달리한다(positive 20분 / negative 10분)
        lambda items: INCIDENTS_CACHE_TTL if items else INCIDENTS_CACHE_TTL_EMPTY,
        _fetch,
    )
