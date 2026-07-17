"""`_get_bus_ride_seconds`가 카카오 API 실패(HTTP 오류뿐 아니라 JSON 파싱 실패 등
비-HTTPError 예외 포함)를 KakaoApiError 하나로 캐치해 기본값으로 폴백하는지 검증한다.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.api import recommend as recommend_mod
from app.services.external.kakao import KakaoApiError


async def _raise_kakao_error(*args, **kwargs):
    raise KakaoApiError("카카오 응답 파싱 실패(JSONDecodeError 등)")


@pytest.mark.asyncio
async def test_get_bus_ride_seconds_falls_back_on_kakao_api_error():
    """카카오 API 실패 시 500을 전파하지 않고 _BUS_RIDE_FALLBACK 값을 반환해야 한다."""
    fake_redis = AsyncMock()
    fake_redis.get = AsyncMock(return_value=None)

    with patch.object(recommend_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(recommend_mod, "fetch_driving_route", side_effect=_raise_kakao_error):
        ride = await recommend_mod._get_bus_ride_seconds(37.339343, 126.73279)

    assert ride == recommend_mod._BUS_RIDE_FALLBACK


@pytest.mark.asyncio
async def test_get_bus_ride_seconds_uses_cache_when_available():
    """캐시 히트 시에는 카카오 API를 호출하지 않아야 한다."""
    fake_redis = AsyncMock()
    fake_redis.get = AsyncMock(return_value="333")

    fetch_mock = AsyncMock(side_effect=_raise_kakao_error)

    with patch.object(recommend_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(recommend_mod, "fetch_driving_route", fetch_mock):
        ride = await recommend_mod._get_bus_ride_seconds(37.339343, 126.73279)

    assert ride == 333
    fetch_mock.assert_not_awaited()
