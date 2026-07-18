"""날씨 서비스 — live job이 forecast raw 캐시를 재사용하는지 검증."""

import pytest
from unittest.mock import AsyncMock, patch

import fakeredis

from app.services.weather import (
    CACHE_KEY_FORECAST_RAW,
    CACHE_TTL_FORECAST,
    _deserialize_fcst_map,
    _serialize_fcst_map,
    refresh_weather_live_cache,
    refresh_weather_forecast_cache,
)
from app.core import cache as cache_mod
from app.core.cache import set_cached_json, get_cached_json


@pytest.fixture
def fake_redis():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


@pytest.fixture
def sample_fcst_tuple_dict() -> dict[tuple[str, str], dict[str, str]]:
    """tuple 키 형식의 샘플 예보 dict."""
    return {
        ("20260718", "0600"): {"TMP": "12", "SKY": "3", "PTY": "0", "POP": "10"},
        ("20260718", "0700"): {"TMP": "14", "SKY": "1", "PTY": "0", "POP": "0"},
        ("20260718", "0800"): {"TMP": "18", "SKY": "1", "PTY": "0", "POP": "0"},
    }


@pytest.fixture
def sample_fcst_items() -> list[dict]:
    """KMA API 응답 형식의 샘플 예보 item 목록."""
    return [
        {"fcstDate": "20260718", "fcstTime": "0600", "category": "TMP", "fcstValue": "12"},
        {"fcstDate": "20260718", "fcstTime": "0600", "category": "SKY", "fcstValue": "3"},
        {"fcstDate": "20260718", "fcstTime": "0600", "category": "PTY", "fcstValue": "0"},
        {"fcstDate": "20260718", "fcstTime": "0600", "category": "POP", "fcstValue": "10"},
        {"fcstDate": "20260718", "fcstTime": "0700", "category": "TMP", "fcstValue": "14"},
        {"fcstDate": "20260718", "fcstTime": "0700", "category": "SKY", "fcstValue": "1"},
        {"fcstDate": "20260718", "fcstTime": "0700", "category": "PTY", "fcstValue": "0"},
        {"fcstDate": "20260718", "fcstTime": "0700", "category": "POP", "fcstValue": "0"},
    ]


@pytest.fixture
def sample_ncst_items() -> list[dict]:
    """KMA API 응답 형식의 샘플 초단기실황 item 목록."""
    return [
        {"category": "T1H", "obsrValue": "13"},
        {"category": "SKY", "obsrValue": "3"},
        {"category": "PTY", "obsrValue": "0"},
    ]


def test_serialize_deserialize_roundtrip(sample_fcst_tuple_dict):
    """직렬화/복원이 원본 데이터를 보존하는지 확인."""
    serialized = _serialize_fcst_map(sample_fcst_tuple_dict)
    deserialized = _deserialize_fcst_map(serialized)
    assert deserialized == sample_fcst_tuple_dict


def test_serialize_key_format(sample_fcst_tuple_dict):
    """직렬화 후 키 형식이 'YYYYMMDD_HHMM'인지 확인."""
    serialized = _serialize_fcst_map(sample_fcst_tuple_dict)
    keys = list(serialized.keys())
    assert all("_" in key for key in keys)
    assert all(len(key.split("_")) == 2 for key in keys)
    assert "20260718_0600" in keys
    assert "20260718_0700" in keys


@pytest.mark.asyncio
async def test_refresh_forecast_cache_stores_raw_fcst(fake_redis, sample_fcst_items):
    """forecast cache refresh가 raw fcst를 별도 캐시에 저장하는지 확인."""
    with patch("app.services.weather.fetch_village_fcst", new_callable=AsyncMock) as mock_fetch, \
         patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        mock_fetch.return_value = sample_fcst_items

        await refresh_weather_forecast_cache()

        # raw 캐시 확인
        raw_cached = await get_cached_json(CACHE_KEY_FORECAST_RAW)
        assert raw_cached is not None
        assert "20260718_0600" in raw_cached
        assert raw_cached["20260718_0600"]["TMP"] == "12"


@pytest.mark.asyncio
async def test_refresh_live_cache_reuses_forecast_raw(fake_redis, sample_fcst_items, sample_ncst_items):
    """live cache refresh가 forecast raw 캐시를 재사용하고 API 호출을 피하는지 확인."""
    # 1단계: forecast raw 캐시 미리 저장
    from app.services.weather import _fcst_map, _serialize_fcst_map
    fcst = _fcst_map(sample_fcst_items)
    fcst_serialized = _serialize_fcst_map(fcst)

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        await set_cached_json(CACHE_KEY_FORECAST_RAW, fcst_serialized, CACHE_TTL_FORECAST)

        # 2단계: live cache refresh 실행, fetch_village_fcst는 호출 금지
        with patch("app.services.weather.fetch_ultra_srt_ncst", new_callable=AsyncMock) as mock_ncst, \
             patch("app.services.weather.fetch_village_fcst", new_callable=AsyncMock) as mock_fcst:
            mock_ncst.return_value = sample_ncst_items
            mock_fcst.return_value = []  # 호출되면 안 됨

            await refresh_weather_live_cache()

            # fetch_village_fcst가 호출되지 않았는지 확인
            mock_fcst.assert_not_called()


@pytest.mark.asyncio
async def test_refresh_live_cache_fallback_on_raw_cache_miss(fake_redis, sample_fcst_items, sample_ncst_items):
    """forecast raw 캐시 미스 시 live job이 fallback으로 fetch_village_fcst를 호출하는지 확인."""
    # raw 캐시가 없는 상태에서 live refresh 실행
    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch("app.services.weather.fetch_ultra_srt_ncst", new_callable=AsyncMock) as mock_ncst, \
         patch("app.services.weather.fetch_village_fcst", new_callable=AsyncMock) as mock_fcst:
        mock_ncst.return_value = sample_ncst_items
        mock_fcst.return_value = sample_fcst_items  # 폴백으로 호출됨

        await refresh_weather_live_cache()

        # fetch_village_fcst가 폴백으로 호출되었는지 확인
        mock_fcst.assert_called_once()
        assert mock_fcst.call_args[1]["hours"] == 12
