import json
import logging

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
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
