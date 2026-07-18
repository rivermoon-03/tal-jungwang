"""`get_or_fetch_with_lock` (Redis 분산 락 single-flight) 단위 테스트.

fakeredis로 실제 Redis 없이 NX/EX 락 동작을 검증한다:
1. 캐시 히트 시 fetch_fn 미호출.
2. 캐시 미스 + 동시 요청 다건 → fetch_fn은 정확히 1회만 호출(중복 호출 방지).
3. 락이 이미 점유된 상태에서 캐시가 채워지면 대기 중이던 호출이 그 값을 재사용.
4. 대기(max_wait) 초과 시 직접 호출로 폴백(가용성 우선, fetch_fn 재호출 허용).
5. Redis 연결 자체가 실패해도 fetch_fn을 직접 호출해 정상 응답.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import fakeredis
import pytest

from app.core import cache as cache_mod
from app.core.cache import get_or_fetch_with_lock


@pytest.fixture
def fake_redis():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


@pytest.mark.asyncio
async def test_cache_hit_skips_fetch(fake_redis):
    await fake_redis.set("k:hit", '{"v": 1}')

    fetch_fn = AsyncMock(return_value={"v": 999})

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        result = await get_or_fetch_with_lock("k:hit", 30, fetch_fn)

    assert result == {"v": 1}
    fetch_fn.assert_not_awaited()


@pytest.mark.asyncio
async def test_concurrent_miss_calls_fetch_once(fake_redis):
    """캐시 미스 상태에서 동시에 여러 요청이 들어와도 실제 외부 호출은 1건."""
    call_count = 0

    async def slow_fetch():
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.15)  # 외부 API 호출 흉내
        return {"v": "fresh"}

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        results = await asyncio.gather(
            *[
                get_or_fetch_with_lock(
                    "k:stampede", 30, slow_fetch,
                    lock_ttl=5, max_wait=2.0, poll_interval=0.02,
                )
                for _ in range(10)
            ]
        )

    assert call_count == 1
    assert all(r == {"v": "fresh"} for r in results)


@pytest.mark.asyncio
async def test_lock_loser_reuses_value_written_by_winner(fake_redis):
    """락을 못 잡은 요청은 winner가 캐시에 쓴 값을 폴링으로 재사용하고,
    winner의 fetch_fn만 실제로 실행된다."""
    winner_fetch = AsyncMock(return_value={"v": "winner"})

    async def loser_fetch():
        raise AssertionError("loser의 fetch_fn이 호출되면 안 된다(락 대기 중 캐시 재사용 기대)")

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        # winner가 먼저 락을 점유하도록 살짝 지연시킨 뒤 loser를 붙인다.
        async def delayed_winner():
            await asyncio.sleep(0.05)
            return await winner_fetch()

        winner_task = asyncio.create_task(
            get_or_fetch_with_lock(
                "k:reuse", 30, delayed_winner,
                lock_ttl=5, max_wait=2.0, poll_interval=0.02,
            )
        )
        await asyncio.sleep(0.01)  # winner가 먼저 락을 잡을 시간을 준다
        loser_task = asyncio.create_task(
            get_or_fetch_with_lock(
                "k:reuse", 30, loser_fetch,
                lock_ttl=5, max_wait=2.0, poll_interval=0.02,
            )
        )

        winner_result, loser_result = await asyncio.gather(winner_task, loser_task)

    assert winner_result == {"v": "winner"}
    assert loser_result == {"v": "winner"}
    winner_fetch.assert_awaited_once()


@pytest.mark.asyncio
async def test_wait_timeout_falls_back_to_direct_fetch(fake_redis):
    """락이 계속 점유된 채로(다른 프로세스가 hang) max_wait을 넘기면
    폴백으로 직접 fetch_fn을 호출해 가용성을 지킨다."""
    await fake_redis.set("k:timeout:lock", "someone-else", nx=True, ex=30)

    fetch_fn = AsyncMock(return_value={"v": "fallback"})

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        result = await get_or_fetch_with_lock(
            "k:timeout", 30, fetch_fn,
            lock_ttl=30, max_wait=0.1, poll_interval=0.02,
        )

    assert result == {"v": "fallback"}
    fetch_fn.assert_awaited_once()


@pytest.mark.asyncio
async def test_redis_unavailable_falls_back_to_direct_fetch():
    """Redis 연결 자체가 실패해도 캐시 오류를 무시하고 직접 호출한다(기존 컨벤션)."""
    fetch_fn = AsyncMock(return_value={"v": "no-redis"})

    with patch.object(cache_mod, "get_redis", AsyncMock(side_effect=ConnectionError("down"))):
        result = await get_or_fetch_with_lock("k:down", 30, fetch_fn)

    assert result == {"v": "no-redis"}
    fetch_fn.assert_awaited_once()


@pytest.mark.asyncio
async def test_winner_caches_result_for_ttl(fake_redis):
    """락을 잡은 쪽이 결과를 지정한 TTL로 캐시에 저장한다."""
    fetch_fn = AsyncMock(return_value={"v": "to-cache"})

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        await get_or_fetch_with_lock("k:store", 42, fetch_fn)

    raw = await fake_redis.get("k:store")
    assert raw == '{"v": "to-cache"}'
    ttl = await fake_redis.ttl("k:store")
    assert 0 < ttl <= 42

    # 락 키는 해제되어 있어야 한다.
    assert await fake_redis.get("k:store:lock") is None


@pytest.mark.asyncio
async def test_fetch_fn_error_propagates_and_releases_lock(fake_redis):
    """fetch_fn이 예외를 던지면 그대로 전파하고, 락은 해제되어 다음 요청이 재시도할 수 있다."""

    async def boom():
        raise RuntimeError("external api down")

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        with pytest.raises(RuntimeError):
            await get_or_fetch_with_lock("k:error", 30, boom)

        # 락 해제 확인 — 재시도 시 다시 락을 잡을 수 있어야 한다.
        assert await fake_redis.get("k:error:lock") is None

        fetch_fn2 = AsyncMock(return_value={"v": "retry-ok"})
        result = await get_or_fetch_with_lock("k:error", 30, fetch_fn2)

    assert result == {"v": "retry-ok"}
