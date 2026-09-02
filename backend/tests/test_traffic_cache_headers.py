"""`/api/v1/traffic`, `/api/v1/traffic/flow` — Cache-Control 헤더 누락 회귀 테스트.

docs/cache-lifetimes.md 표3은 두 엔드포인트 모두 헤더가 붙는다고 적었지만
실제로는 빠져 있었다. 다른 엔드포인트(bus.py/shuttle.py)와 동일하게
`response.headers["Cache-Control"]`을 채우는지 확인한다.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import fakeredis
import pytest
from fastapi import Response

from app.api import traffic as traffic_api

_TRAFFIC_PAYLOAD = {"roads": [], "updated_at": "2026-09-02T00:00:00+09:00"}
_FLOW_PAYLOAD = {
    "road_name": "마유로",
    "day_type": "weekday",
    "sample_days": 0,
    "points": [],
}


def _make_request(path: str):
    """slowapi.Limiter가 isinstance(Request) 체크하므로 진짜 Starlette Request가 필요."""
    from starlette.requests import Request

    scope = {
        "type": "http",
        "method": "GET",
        "path": path,
        "headers": [],
        "query_string": b"",
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
        "scheme": "http",
        "root_path": "",
        "app": None,
    }
    return Request(scope)


@pytest.fixture
def fake_redis():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


# ── GET /api/v1/traffic ──────────────────────────────────────


@pytest.mark.asyncio
async def test_traffic_엔드포인트는_동적_ttl로_Cache_Control_헤더를_붙인다():
    response = Response()
    with patch.object(
        traffic_api, "get_or_fetch_with_lock", AsyncMock(return_value=_TRAFFIC_PAYLOAD)
    ), patch.object(traffic_api, "_traffic_ttl", return_value=60):
        result = await traffic_api.get_traffic(request=_make_request("/api/v1/traffic"), response=response)

    assert result.success is True
    assert response.headers["Cache-Control"] == "public, max-age=60, stale-while-revalidate=300"


@pytest.mark.asyncio
async def test_traffic_엔드포인트는_평시_ttl일_때도_5배로_stale_while_revalidate를_잡는다():
    response = Response()
    with patch.object(
        traffic_api, "get_or_fetch_with_lock", AsyncMock(return_value=_TRAFFIC_PAYLOAD)
    ), patch.object(traffic_api, "_traffic_ttl", return_value=300):
        await traffic_api.get_traffic(request=_make_request("/api/v1/traffic"), response=response)

    assert response.headers["Cache-Control"] == "public, max-age=300, stale-while-revalidate=1500"


# ── GET /api/v1/traffic/flow ─────────────────────────────────


@pytest.mark.asyncio
async def test_flow_엔드포인트는_캐시_미스_시에도_Cache_Control_헤더를_붙인다(fake_redis):
    response = Response()
    with patch.object(traffic_api, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(traffic_api, "set_cached_json", AsyncMock()), \
         patch.object(traffic_api, "compute_flow", AsyncMock(return_value=_FLOW_PAYLOAD)):
        result = await traffic_api.traffic_flow(
            request=_make_request("/api/v1/traffic/flow"),
            response=response,
            day_type="weekday",
            direction=None,
            db=AsyncMock(),
        )

    assert result.success is True
    assert response.headers["Cache-Control"] == (
        f"public, max-age={traffic_api._FLOW_CACHE_TTL}, "
        f"stale-while-revalidate={traffic_api._FLOW_CACHE_TTL * 5}"
    )


@pytest.mark.asyncio
async def test_flow_엔드포인트는_캐시_히트일_때도_헤더를_붙인다():
    response = Response()
    with patch.object(traffic_api, "get_cached_json", AsyncMock(return_value=_FLOW_PAYLOAD)), \
         patch.object(traffic_api, "compute_flow", AsyncMock()) as compute_mock:
        result = await traffic_api.traffic_flow(
            request=_make_request("/api/v1/traffic/flow"),
            response=response,
            day_type="weekday",
            direction=None,
            db=AsyncMock(),
        )

    assert result.success is True
    compute_mock.assert_not_awaited()
    assert "max-age=1800" in response.headers["Cache-Control"]
    assert "stale-while-revalidate=9000" in response.headers["Cache-Control"]
