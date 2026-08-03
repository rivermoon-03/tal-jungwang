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


def _live_writes(set_mock):
    """실황 캐시 키(weather:live)에 대한 쓰기만 골라낸다.

    저하 응답일 때는 실패 사유(weather:live:error)도 함께 기록하므로,
    "아무것도 안 썼다"로 단언하면 그 기록까지 금지하는 셈이 된다.
    """
    return [c for c in set_mock.await_args_list if c.args[0] == weather_service.CACHE_KEY_LIVE]


@pytest.mark.asyncio
async def test_저하_응답은_짧게만_캐시된다():
    with patch.object(weather_service, "set_cached_json", AsyncMock()) as set_mock, \
         patch.object(weather_service, "get_cached_json", AsyncMock(return_value=None)):
        await weather_service.store_live_cache(_result(None))

    writes = _live_writes(set_mock)
    assert len(writes) == 1
    assert writes[0].args[2] == weather_service.CACHE_TTL_LIVE_DEGRADED


@pytest.mark.asyncio
async def test_저하_응답은_기존_정상_캐시를_덮지_않는다():
    good = {"current_temp": 27}
    with patch.object(weather_service, "set_cached_json", AsyncMock()) as set_mock, \
         patch.object(weather_service, "get_cached_json", AsyncMock(return_value=good)):
        await weather_service.store_live_cache(_result(None))

    assert _live_writes(set_mock) == []


@pytest.mark.asyncio
async def test_저하_응답은_실패_사유를_남긴다():
    """기온이 왜 비었는지 남겨야 /health 로 원인을 확인할 수 있다."""
    from app.services.external import kma

    with patch.object(weather_service, "set_cached_json", AsyncMock()) as set_mock, \
         patch.object(weather_service, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(kma, "LAST_ERROR", "초단기실황: resultCode=22 LIMITED"):
        await weather_service.store_live_cache(_result(None))

    errors = [c for c in set_mock.await_args_list
              if c.args[0] == weather_service.CACHE_KEY_LIVE_ERROR]
    assert len(errors) == 1
    assert "resultCode=22" in errors[0].args[1]["reason"]


# ── 기상청 오류 응답 판별 ──────────────────────────────────────────────────
# 기상청은 키 오류·트래픽 초과도 HTTP 200 + resultCode 로 돌려준다. 예전에는
# 이걸 그냥 빈 배열로 삼켜서 "데이터 없음"과 구분되지 않았고, 기온이 사라져도
# 원인을 알 수 없었다.


def test_오류_resultCode는_빈_목록과_사유를_남긴다():
    from app.services.external import kma

    kma._record(None)
    items = kma._parse_items(
        {"response": {"header": {"resultCode": "22",
                                 "resultMsg": "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR"}}},
        what="초단기실황",
    )
    assert items == []
    assert "resultCode=22" in kma.LAST_ERROR


def test_정상_응답은_사유를_지운다():
    from app.services.external import kma

    kma._record("이전 실패")
    items = kma._parse_items(
        {"response": {"header": {"resultCode": "00"},
                      "body": {"items": {"item": [{"category": "T1H", "obsrValue": "13"}]}}}},
        what="초단기실황",
    )
    assert len(items) == 1
    assert kma.LAST_ERROR is None
