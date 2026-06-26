import json
import logging

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
