"""데이터 신선도 SLO — 도메인별 마지막 성공 수집 시각을 추적한다.

"왜 안 바뀌지" 를 사용자 신고로 사후 추적하는 대신, 스케줄러 잡이 성공할 때마다
``mark_fresh(domain)`` 을 호출해 Redis에 KST ISO 시각을 남기고, ``/health`` 가
``get_freshness_report()`` 로 도메인별 ``age_seconds`` 를 노출해 사전에 감지한다.

키에는 TTL을 두지 않는다. 값이 만료돼 사라지면 "한 번도 성공한 적 없음"과
"계속 실패 중"을 구분할 수 없기 때문이다. 수집이 멈추면 age_seconds가 계속
커지는 것 자체가 신호가 된다.
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.cache import get_redis

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")

_KEY_PREFIX = "tj:freshness:"

# 신선도를 추적하는 등록 도메인. scheduler.py의 각 주기 잡이 성공 지점에서
# 이 중 하나의 이름으로 mark_fresh를 호출한다. 목록을 늘릴 땐 scheduler.py
# 삽입 지점과 docs/cache-lifetimes.md를 함께 갱신한다.
DOMAINS: tuple[str, ...] = (
    "bus",
    "subway",
    "shuttle",
    "cafeteria",
    "weather",
    "traffic",
    "notices",
)


def _key(domain: str) -> str:
    return f"{_KEY_PREFIX}{domain}"


async def mark_fresh(domain: str) -> None:
    """도메인의 마지막 성공 시각(KST ISO)을 Redis에 기록한다.

    TTL 없이 저장한다(위 모듈 docstring 참조). Redis 오류는 기존 cache-aside
    컨벤션과 동일하게 무시한다 — 신선도 기록 실패가 실제 수집/응답을 막으면
    안 된다.
    """
    try:
        redis = await get_redis()
        await redis.set(_key(domain), datetime.now(_KST).isoformat())
    except Exception as exc:
        logger.warning("Freshness mark 실패 [%s]: %s", domain, exc)


async def get_freshness_report() -> dict[str, dict[str, object]]:
    """등록 도메인별 마지막 성공 시각/age_seconds를 mget 1회로 조회한다.

    Redis 연결 자체가 실패하면 헬스 응답 전체를 죽이지 않도록 빈 dict를
    반환한다. 한 번도 mark_fresh가 호출되지 않은 도메인은 결과에서 제외한다
    (아직 값이 없음과 값이 오래됨을 호출부가 구분할 수 있게).
    """
    try:
        redis = await get_redis()
        raw_values = await redis.mget([_key(domain) for domain in DOMAINS])
    except Exception as exc:
        logger.warning("Freshness 조회 실패: %s", exc)
        return {}

    now = datetime.now(_KST)
    report: dict[str, dict[str, object]] = {}
    for domain, raw in zip(DOMAINS, raw_values):
        if not raw:
            continue
        try:
            last_success = datetime.fromisoformat(raw)
        except ValueError:
            logger.warning("Freshness 값 파싱 실패 [%s]: %r", domain, raw)
            continue
        age_seconds = max(0, int((now - last_success).total_seconds()))
        report[domain] = {
            "last_success": last_success.isoformat(),
            "age_seconds": age_seconds,
        }
    return report
