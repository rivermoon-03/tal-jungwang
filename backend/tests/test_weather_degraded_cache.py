"""실황 저하 응답 캐시 정책 회귀 테스트.

실제 장애(2026-08): data.go.kr가 평문 HTTP를 끊어 kma.py(http://)의 모든 호출이
타임아웃 → 기온·바람·예보가 빈 응답으로 만들어졌고, 그게 1시간 TTL로 캐시돼
장애 복구 후에도 한 시간 동안 히어로에 기온이 안 떴다.
"""
from unittest.mock import AsyncMock, patch

import pytest

from app.schemas.weather import CurrentWeatherResponse, TimeBucket
from app.services import weather as weather_service
from app.services.external import kma


def _result(temp):
    return CurrentWeatherResponse(
        current_temp=temp,
        current_sky="맑음",
        icon="sunny",
        rain_prob=0,
        pm10_grade="알수없음",
        time_bucket=TimeBucket(label="밤", next_label="내일 아침"),
    )


def test_기상청_주소는_https다():
    """평문 http는 data.go.kr가 응답하지 않는다 — 되돌리면 전체 날씨가 빈다."""
    assert kma.BASE_URL.startswith("https://")


@pytest.mark.asyncio
async def test_정상_응답은_정규_TTL로_캐시된다():
    with patch.object(weather_service, "set_cached_json", AsyncMock()) as set_mock, \
         patch.object(weather_service, "get_cached_json", AsyncMock(return_value=None)):
        await weather_service.store_live_cache(_result(27))

    assert set_mock.await_args.args[2] == weather_service.CACHE_TTL_LIVE


@pytest.mark.asyncio
async def test_저하_응답은_짧게만_캐시된다():
    with patch.object(weather_service, "set_cached_json", AsyncMock()) as set_mock, \
         patch.object(weather_service, "get_cached_json", AsyncMock(return_value=None)):
        await weather_service.store_live_cache(_result(None))

    assert set_mock.await_args.args[2] == weather_service.CACHE_TTL_LIVE_DEGRADED


@pytest.mark.asyncio
async def test_저하_응답은_기존_정상_캐시를_덮지_않는다():
    good = {"current_temp": 27}
    with patch.object(weather_service, "set_cached_json", AsyncMock()) as set_mock, \
         patch.object(weather_service, "get_cached_json", AsyncMock(return_value=good)):
        await weather_service.store_live_cache(_result(None))

    set_mock.assert_not_awaited()
