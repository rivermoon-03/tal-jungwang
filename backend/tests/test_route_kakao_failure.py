"""카카오 API 실패(KakaoApiError) 시 route.py 엔드포인트가 500을 그대로
노출하지 않고 503(HTTPException) 또는 graceful null 폴백으로 처리하는지 검증한다.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import fakeredis
import pytest
from fastapi import HTTPException, Response

from app.api import route as route_mod
from app.core import cache as cache_mod
from app.schemas.route import Coordinate, RouteRequest
from app.services.external.kakao import KakaoApiError


def _make_request(method: str = "POST", path: str = "/api/v1/route/driving"):
    """slowapi.Limiter가 isinstance(Request) 체크하므로 진짜 Starlette Request가 필요."""
    from starlette.requests import Request

    scope = {
        "type": "http",
        "method": method,
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


async def _raise_kakao_error(*args, **kwargs):
    raise KakaoApiError("카카오 API 5xx 오류")


@pytest.mark.asyncio
async def test_driving_route_returns_503_not_500_on_kakao_failure(fake_redis):
    """카카오 API가 실패하면 500이 아니라 503 HTTPException이 발생해야 한다."""
    req = RouteRequest(
        origin=Coordinate(lat=37.34, lng=126.73),
        destination=Coordinate(lat=37.35, lng=126.74),
    )

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(route_mod, "fetch_driving_route", side_effect=_raise_kakao_error):
        with pytest.raises(HTTPException) as exc_info:
            await route_mod.driving_route(
                request=_make_request(),
                response=Response(),
                req=req,
            )

    assert exc_info.value.status_code == 503
    assert exc_info.value.status_code != 500
    assert exc_info.value.detail


@pytest.mark.asyncio
async def test_taxi_to_station_falls_back_to_null_on_kakao_failure(fake_redis):
    """택시-정왕역 카드는 카카오 실패 시에도 500 없이 duration_seconds=None 으로 degrade."""
    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(route_mod, "fetch_driving_route", side_effect=_raise_kakao_error):
        result = await route_mod.taxi_to_station(
            request=_make_request(method="GET", path="/api/v1/route/taxi-to-station"),
            response=Response(),
        )

    assert result.success is True
    assert result.data["duration_seconds"] is None


@pytest.mark.asyncio
async def test_taxi_destinations_placeholder_on_kakao_failure(fake_redis):
    """택시 목적지 목록은 개별 목적지 실패해도 전체 요청이 죽지 않고 null placeholder를 반환."""
    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(route_mod, "fetch_driving_route", side_effect=_raise_kakao_error):
        result = await route_mod.taxi_destinations(
            request=_make_request(method="GET", path="/api/v1/route/taxi-destinations"),
            response=Response(),
        )

    assert result.success is True
    destinations = result.data["destinations"]
    assert len(destinations) == len(route_mod._TAXI_DESTINATIONS)
    for dest in destinations:
        assert dest["duration_seconds"] is None
