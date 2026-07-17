"""`get_arrival_stats`의 Redis single-flight 캐시(cache-aside) 동작 검증.

fakeredis로 실제 Redis 없이:
1. 캐시 히트 시 DB(session.execute) 미호출.
2. 캐시 미스 + 동시 요청 다건 → DB 쿼리는 단 1세트만 나간다(스탬피드 방지).
3. 사전집계 hit은 6h TTL, negative/저표본 fallback은 10min TTL로 저장된다.
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import fakeredis
import pytest

from app.core import cache as cache_mod
from app.services import bus_stats


@pytest.fixture
def fake_redis():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


class _FakeResult:
    """SQLAlchemy `Result`의 `.mappings().first()` 체인만 흉내낸다."""

    def __init__(self, row: dict | None):
        self._row = row

    def mappings(self):
        return self

    def first(self):
        return self._row


class _StatsRow(dict):
    """`mappings().first()`가 반환하는 dict-like row. `dict(row)` 변환 가능해야 한다."""


def _make_session(*, prestats_row: dict | None, fallback_row: dict | None):
    """첫 execute 호출은 bus_arrival_stats 조회, 두번째는 fallback 조회로 응답."""
    session = AsyncMock()
    call_count = 0

    async def execute(*_args, **_kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _FakeResult(_StatsRow(prestats_row) if prestats_row else None)
        return _FakeResult(_StatsRow(fallback_row) if fallback_row else None)

    session.execute.side_effect = execute
    return session


_PRESTATS_ROW = {
    "p10_interval_sec": 60,
    "p50_interval_sec": 240,
    "p90_interval_sec": 540,
    "mean_interval_sec": 250,
    "sample_size": 28,
    "computed_at": None,
}


@pytest.mark.asyncio
async def test_cache_hit_skips_db(fake_redis):
    key = bus_stats._cache_key(12, 100, "weekday", 18)
    await fake_redis.set(key, '{"p10_min": 1, "p50_min": 4, "p90_min": 9, "mean_min": 4, "tolerance_min": 4, "sample_size": 28, "computed_at": null}')

    session = _make_session(prestats_row=_PRESTATS_ROW, fallback_row=None)

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        result = await bus_stats.get_arrival_stats(session, 12, 100, "weekday", 18)

    assert result["sample_size"] == 28
    session.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_concurrent_miss_queries_db_once(fake_redis):
    """캐시 미스 상태에서 동시 요청이 몰려도 실제 DB 쿼리는 1세트만 나간다."""
    query_sets = 0

    async def make_execute(*_args, **_kwargs):
        nonlocal query_sets
        query_sets += 1
        await asyncio.sleep(0.05)  # DB round-trip 흉내
        return _FakeResult(_StatsRow(_PRESTATS_ROW))

    session = AsyncMock()
    session.execute.side_effect = make_execute

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        results = await asyncio.gather(
            *[
                bus_stats.get_arrival_stats(session, 12, 100, "weekday", 18)
                for _ in range(8)
            ]
        )

    assert query_sets == 1  # 1개의 fetch만 bus_arrival_stats를 조회
    assert all(r["sample_size"] == 28 for r in results)


@pytest.mark.asyncio
async def test_positive_hit_cached_with_long_ttl(fake_redis):
    session = _make_session(prestats_row=_PRESTATS_ROW, fallback_row=None)

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        result = await bus_stats.get_arrival_stats(session, 1, 2, "weekday", 8)

    assert result["sample_size"] == 28
    key = bus_stats._cache_key(1, 2, "weekday", 8)
    ttl = await fake_redis.ttl(key)
    assert bus_stats.STATS_NEGATIVE_TTL < ttl <= bus_stats.STATS_CACHE_TTL


@pytest.mark.asyncio
async def test_no_data_cached_with_short_negative_ttl(fake_redis):
    session = _make_session(prestats_row=None, fallback_row={"mean_sec": 200, "n": 1})

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        result = await bus_stats.get_arrival_stats(session, 3, 4, "sunday", 2)

    assert result is None
    key = bus_stats._cache_key(3, 4, "sunday", 2)
    ttl = await fake_redis.ttl(key)
    assert 0 < ttl <= bus_stats.STATS_NEGATIVE_TTL


@pytest.mark.asyncio
async def test_low_sample_fallback_cached_with_short_negative_ttl(fake_redis):
    session = _make_session(prestats_row=None, fallback_row={"mean_sec": 300, "n": 5})

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        result = await bus_stats.get_arrival_stats(session, 5, 6, "weekday", 9)

    assert result["is_low_sample"] is True
    assert result["mean_min"] == 5
    key = bus_stats._cache_key(5, 6, "weekday", 9)
    ttl = await fake_redis.ttl(key)
    assert 0 < ttl <= bus_stats.STATS_NEGATIVE_TTL


def test_resolve_stats_ttl_branches():
    assert bus_stats._resolve_stats_ttl({"sample_size": None}) == bus_stats.STATS_NEGATIVE_TTL
    assert bus_stats._resolve_stats_ttl(
        {"sample_size": 5, "is_low_sample": True}
    ) == bus_stats.STATS_NEGATIVE_TTL
    assert bus_stats._resolve_stats_ttl(
        {"sample_size": 28, "p50_min": 4}
    ) == bus_stats.STATS_CACHE_TTL
