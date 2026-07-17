import asyncio
import json
import logging
import time
from collections.abc import Awaitable, Callable
from typing import TypeVar

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        # Railway 환경: 컨테이너 ↔ Redis 사이에 별도 hop 이 있으므로 idle TCP 가
        # 끊겨도 자동 회복하도록 keepalive·health check·retry 를 명시한다.
        _redis = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            max_connections=50,
            socket_keepalive=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            health_check_interval=30,
            retry_on_timeout=True,
        )
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


async def get_cached_json(key: str) -> dict | list | None:
    """Redis에서 JSON 캐시를 읽는다. 미스 또는 오류 시 None 반환."""
    try:
        redis = await get_redis()
        raw = await redis.get(key)
        if raw:
            return json.loads(raw)
    except Exception as exc:
        logger.warning("Cache read failed [%s]: %s", key, exc)
    return None


async def set_cached_json(key: str, value: dict | list, ttl: int) -> None:
    """Redis에 JSON 캐시를 저장한다. 오류는 무시 (캐시 미스로 처리)."""
    try:
        redis = await get_redis()
        await redis.set(
            key,
            json.dumps(value, ensure_ascii=False, default=str),
            ex=ttl,
        )
    except Exception as exc:
        logger.warning("Cache write failed [%s]: %s", key, exc)


async def delete_keys(pattern: str) -> int:
    """glob 패턴에 매칭되는 캐시 키를 모두 삭제한다. 삭제한 키 수 반환 (오류 시 0).

    scan_iter로 비차단 순회한다(KEYS 미사용 — 운영 Redis 블로킹 방지).
    """
    try:
        redis = await get_redis()
        deleted = 0
        async for key in redis.scan_iter(match=pattern, count=100):
            await redis.delete(key)
            deleted += 1
        return deleted
    except Exception as exc:
        logger.warning("Cache delete failed [%s]: %s", pattern, exc)
        return 0


T = TypeVar("T")

# ── Single-flight (분산 락) 기본값 ─────────────────────────────────────────
# 락 TTL은 외부 API 최악 지연(httpx: connect 5s + read 10s ≈ 15s, core/http_client.py)
# 보다 여유 있게 잡아야 한다. 락이 API 응답보다 먼저 풀리면 다음 폴링 요청이
# 락을 재획득해 중복 호출이 재발한다 — 반드시 외부 API 타임아웃 변경 시 함께 재검토.
_LOCK_TTL_DEFAULT = 20        # 초
_LOCK_KEY_SUFFIX = ":lock"
_LOCK_POLL_INTERVAL = 0.08    # 초 — 80ms 간격 폴링
_LOCK_MAX_WAIT = 5.0          # 초 — 초과 시 직접 호출 폴백(가용성 우선, 중복 호출 허용)


async def get_or_fetch_with_lock(
    key: str,
    ttl: int,
    fetch_fn: Callable[[], Awaitable[T]],
    *,
    lock_ttl: int = _LOCK_TTL_DEFAULT,
    max_wait: float = _LOCK_MAX_WAIT,
    poll_interval: float = _LOCK_POLL_INTERVAL,
) -> T:
    """캐시 조회 → 미스 시 Redis 분산 락으로 single-flight 후 외부 호출.

    캐시 TTL 만료 직후 동시 요청이 몰려도 실제 `fetch_fn` 호출은 1건만 나가도록
    `SET key:lock NX EX <lock_ttl>`로 락을 시도한다.
    - 락 획득: `fetch_fn()` 호출 → 캐시 저장(`ttl`) → 락 해제(자기 토큰일 때만) → 결과 반환.
    - 락 실패(이미 다른 요청이 채우는 중): `poll_interval` 간격으로 캐시가 채워지길
      대기하다가, `max_wait` 초과 시 가용성을 우선해 `fetch_fn()`을 직접 호출한다
      (이 경우 드물게 중복 호출이 발생할 수 있으나, 무한 대기보다 안전).
    - Redis 연결 자체가 실패하면 락 없이 바로 `fetch_fn()`을 호출한다
      (기존 cache-aside 컨벤션과 동일하게 캐시 오류를 무시하고 가용성 유지).

    `fetch_fn`이 예외를 던지면 그대로 전파한다(캐시에 오류를 저장하지 않음).
    호출부에서 기존과 동일하게 예외를 잡아 폴백 처리할 수 있다.
    """
    cached = await get_cached_json(key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    try:
        redis = await get_redis()
    except Exception as exc:
        logger.warning("Lock: Redis 연결 실패, 락 없이 직접 호출 [%s]: %s", key, exc)
        return await fetch_fn()

    lock_key = f"{key}{_LOCK_KEY_SUFFIX}"
    token = f"{id(asyncio.current_task())}:{time.monotonic_ns()}"

    acquired = False
    try:
        acquired = bool(await redis.set(lock_key, token, nx=True, ex=lock_ttl))
    except Exception as exc:
        logger.warning("Lock 획득 시도 실패 [%s]: %s", key, exc)

    if acquired:
        try:
            result = await fetch_fn()
            await set_cached_json(key, result, ttl)
            return result
        finally:
            try:
                # best-effort compare-and-delete — 완벽한 원자성은 보장하지 않지만
                # (락 TTL 만료 후 다른 홀더의 락을 지우는 극히 드문 레이스는 허용),
                # 정상 케이스에서 자기 락만 해제해 다음 갱신 주기를 빠르게 연다.
                if await redis.get(lock_key) == token:
                    await redis.delete(lock_key)
            except Exception as exc:
                logger.warning("Lock 해제 실패 [%s]: %s", key, exc)

    # 락 획득 실패 — 다른 요청이 채우길 짧게 폴링 대기
    deadline = time.monotonic() + max_wait
    while time.monotonic() < deadline:
        await asyncio.sleep(poll_interval)
        cached = await get_cached_json(key)
        if cached is not None:
            return cached  # type: ignore[return-value]

    logger.warning("Lock 대기 초과, 직접 호출로 폴백 [%s]", key)
    return await fetch_fn()
