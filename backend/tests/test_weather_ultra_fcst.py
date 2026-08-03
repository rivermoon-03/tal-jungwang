"""이동지수 초단기예보 전환 테스트.

단기예보(1일 8회)의 강수확률은 최대 3시간 묵는다. 이동지수의 강수·낙뢰 판정을
초단기예보(getUltraSrtFcst, 매시 30분 발표)로 바꾸고, 실패 시 기존 단기예보로
조용히 저하되는지 검증한다. 외부 API는 전부 모킹, 시각은 KST 로 고정한다.
"""
from datetime import datetime
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

import pytest

from app.schemas.weather import CurrentWeatherResponse, TimeBucket
from app.services import weather as weather_service
from app.services.external import kma

_KST = ZoneInfo("Asia/Seoul")


def _kst(y, m, d, hh, mm):
    return datetime(y, m, d, hh, mm, tzinfo=_KST)


# ── baseTime 경계 — 매시 30분 발표, 45분부터 제공 ──────────────────────


def test_45분_이후는_그_시각_30분_발표분():
    with patch.object(kma, "_kst_now", return_value=_kst(2026, 8, 3, 14, 45)):
        assert kma._base_date_time_ultra_fcst() == ("20260803", "1430")


def test_45분_직전은_직전_시_발표분():
    with patch.object(kma, "_kst_now", return_value=_kst(2026, 8, 3, 14, 44)):
        assert kma._base_date_time_ultra_fcst() == ("20260803", "1330")


def test_자정_직후는_전날_23시30분_발표분():
    with patch.object(kma, "_kst_now", return_value=_kst(2026, 8, 3, 0, 10)):
        assert kma._base_date_time_ultra_fcst() == ("20260802", "2330")


# ── fetch_ultra_srt_fcst — 파싱과 실패 시 None ─────────────────────────


class _Resp:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def _ok_payload(items):
    return {"response": {"header": {"resultCode": "00"},
                         "body": {"items": {"item": items}}}}


def _client(payload):
    client = AsyncMock()
    client.get = AsyncMock(return_value=_Resp(payload))
    return client


@pytest.mark.asyncio
async def test_초단기예보는_시각별_slots_로_파싱된다():
    items = [
        {"fcstDate": "20260803", "fcstTime": "1500", "category": "T1H", "fcstValue": "29"},
        {"fcstDate": "20260803", "fcstTime": "1500", "category": "PTY", "fcstValue": "1"},
        {"fcstDate": "20260803", "fcstTime": "1500", "category": "LGT", "fcstValue": "1.2"},
        {"fcstDate": "20260803", "fcstTime": "1600", "category": "RN1", "fcstValue": "강수없음"},
        # 판정에 안 쓰는 카테고리는 버린다
        {"fcstDate": "20260803", "fcstTime": "1500", "category": "VEC", "fcstValue": "180"},
    ]
    with patch.object(kma, "_kst_now", return_value=_kst(2026, 8, 3, 14, 50)), \
         patch.object(kma, "get_http_client", AsyncMock(return_value=_client(_ok_payload(items)))):
        result = await kma.fetch_ultra_srt_fcst()

    assert result["base_date"] == "20260803"
    assert result["base_time"] == "1430"
    assert result["slots"][("20260803", "1500")] == {"T1H": "29", "PTY": "1", "LGT": "1.2"}
    assert result["slots"][("20260803", "1600")] == {"RN1": "강수없음"}
    assert "VEC" not in result["slots"][("20260803", "1500")]


@pytest.mark.asyncio
async def test_초단기예보_오류_resultCode는_None_과_사유():
    payload = {"response": {"header": {"resultCode": "22", "resultMsg": "LIMITED"}}}
    with patch.object(kma, "get_http_client", AsyncMock(return_value=_client(payload))):
        assert await kma.fetch_ultra_srt_fcst() is None
    assert "초단기예보" in kma.LAST_ERROR and "resultCode=22" in kma.LAST_ERROR


@pytest.mark.asyncio
async def test_초단기예보_네트워크_예외는_None_과_사유():
    client = AsyncMock()
    client.get = AsyncMock(side_effect=TimeoutError("timeout"))
    with patch.object(kma, "get_http_client", AsyncMock(return_value=client)):
        assert await kma.fetch_ultra_srt_fcst() is None
    assert kma.LAST_ERROR.startswith("초단기예보")


# ── _walk_precip_inputs — 향후 1~2시간 창 판정 ─────────────────────────


def _ultra(slots):
    return {"base_time": "1430", "slots": slots}


def test_창_내_강수형태가_있으면_rain_soon():
    now = _kst(2026, 8, 3, 14, 50)
    ultra = _ultra({
        ("20260803", "1500"): {"PTY": "1", "LGT": "0"},
        ("20260803", "1600"): {"PTY": "0", "LGT": "0"},
    })
    rain_soon, lightning, label = weather_service._walk_precip_inputs(ultra, now)
    assert rain_soon is True
    assert lightning is False
    assert label == "14:30 발표 초단기예보 기준"


def test_창_내_낙뢰가_있으면_lightning():
    now = _kst(2026, 8, 3, 14, 50)
    ultra = _ultra({
        ("20260803", "1500"): {"PTY": "0", "LGT": "0"},
        ("20260803", "1600"): {"PTY": "0", "LGT": "0.8"},
    })
    rain_soon, lightning, _ = weather_service._walk_precip_inputs(ultra, now)
    assert rain_soon is False
    assert lightning is True


def test_창_밖_3시간_뒤_비는_판정에_들어가지_않는다():
    now = _kst(2026, 8, 3, 14, 50)
    ultra = _ultra({
        ("20260803", "1500"): {"PTY": "0", "LGT": "0"},
        ("20260803", "1600"): {"PTY": "0", "LGT": "0"},
        ("20260803", "1700"): {"PTY": "1", "LGT": "5"},
    })
    rain_soon, lightning, _ = weather_service._walk_precip_inputs(ultra, now)
    assert rain_soon is False and lightning is False


def test_자정_넘김_창은_다음날_슬롯을_본다():
    now = _kst(2026, 8, 3, 23, 50)
    ultra = _ultra({
        ("20260804", "0000"): {"PTY": "0", "LGT": "0"},
        ("20260804", "0100"): {"PTY": "2", "LGT": "0"},
    })
    rain_soon, lightning, _ = weather_service._walk_precip_inputs(ultra, now)
    assert rain_soon is True and lightning is False


def test_초단기_없으면_단기예보_폴백_라벨():
    now = _kst(2026, 8, 3, 14, 50)
    with patch.object(weather_service, "_base_date_time_fcst",
                      return_value=("20260803", "1100")):
        rain_soon, lightning, label = weather_service._walk_precip_inputs(None, now)
    assert rain_soon is None
    assert lightning is False
    assert label == "11:00 발표 단기예보 기준"


def test_창에_걸리는_슬롯이_없으면_폴백으로_저하():
    """캐시가 낡아 +1~+2h 슬롯이 비면 초단기 실패와 같게 취급한다."""
    now = _kst(2026, 8, 3, 22, 50)
    ultra = _ultra({("20260803", "1500"): {"PTY": "1", "LGT": "9"}})
    with patch.object(weather_service, "_base_date_time_fcst",
                      return_value=("20260803", "2000")):
        rain_soon, lightning, label = weather_service._walk_precip_inputs(ultra, now)
    assert rain_soon is None and lightning is False
    assert label == "20:00 발표 단기예보 기준"


# ── _get_ultra_fcst_cached — cache-aside 1시간 ─────────────────────────


@pytest.mark.asyncio
async def test_캐시_히트면_기상청을_부르지_않는다():
    cached = {"base_date": "20260803", "base_time": "1430",
              "slots": {"20260803_1500": {"PTY": "1", "LGT": "0"}}}
    with patch.object(weather_service, "get_cached_json", AsyncMock(return_value=cached)), \
         patch.object(weather_service, "fetch_ultra_srt_fcst", AsyncMock()) as fetch_mock:
        result = await weather_service._get_ultra_fcst_cached()

    fetch_mock.assert_not_called()
    assert result["slots"][("20260803", "1500")] == {"PTY": "1", "LGT": "0"}


@pytest.mark.asyncio
async def test_캐시_미스면_조회해서_1시간_캐시한다():
    fetched = {"base_date": "20260803", "base_time": "1430",
               "slots": {("20260803", "1500"): {"PTY": "0", "LGT": "0"}}}
    with patch.object(weather_service, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(weather_service, "set_cached_json", AsyncMock()) as set_mock, \
         patch.object(weather_service, "fetch_ultra_srt_fcst", AsyncMock(return_value=fetched)):
        result = await weather_service._get_ultra_fcst_cached()

    assert result["base_time"] == "1430"
    args = set_mock.await_args.args
    assert args[0] == weather_service.CACHE_KEY_ULTRA_FCST
    assert args[1]["slots"] == {"20260803_1500": {"PTY": "0", "LGT": "0"}}
    assert args[2] == weather_service.CACHE_TTL_ULTRA_FCST == 3600


@pytest.mark.asyncio
async def test_조회_실패는_캐시하지_않는다():
    """실패를 1시간 굳히면 그동안 초단기 전환이 통째로 죽는다 — 에어코리아와 같은 정책."""
    with patch.object(weather_service, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(weather_service, "set_cached_json", AsyncMock()) as set_mock, \
         patch.object(weather_service, "fetch_ultra_srt_fcst", AsyncMock(return_value=None)):
        assert await weather_service._get_ultra_fcst_cached() is None

    set_mock.assert_not_called()


# ── _apply_air 통합 — 초단기 우선, 실패 시 조용한 저하 ─────────────────


def _current(rain_prob=70, temp=22):
    return CurrentWeatherResponse(
        current_temp=temp,
        current_sky="맑음",
        icon="sunny",
        rain_prob=rain_prob,
        pm10_grade="알수없음",
        time_bucket=TimeBucket(label="오후", next_label="밤"),
    )


def test_초단기_비_없음이면_묵은_강수확률을_이긴다():
    now = _kst(2026, 8, 3, 14, 50)
    ultra = _ultra({
        ("20260803", "1500"): {"PTY": "0", "LGT": "0"},
        ("20260803", "1600"): {"PTY": "0", "LGT": "0"},
    })
    result = weather_service._apply_air(_current(rain_prob=70), None, ultra, now=now)
    assert result.walk_index["level"] == "good"
    assert result.walk_index["source_label"] == "14:30 발표 초단기예보 기준"


def test_초단기_낙뢰는_실내_권장으로_승급된다():
    now = _kst(2026, 8, 3, 14, 50)
    ultra = _ultra({
        ("20260803", "1500"): {"PTY": "1", "LGT": "2.5"},
        ("20260803", "1600"): {"PTY": "0", "LGT": "0"},
    })
    result = weather_service._apply_air(_current(rain_prob=0), None, ultra, now=now)
    assert result.walk_index["level"] == "indoor"
    assert result.walk_index["reason"] == "낙뢰 예보"
    assert any(f["key"] == "lightning" for f in result.walk_index["factors"])


def test_초단기_실패면_단기예보_판정으로_조용히_저하():
    now = _kst(2026, 8, 3, 14, 50)
    with patch.object(weather_service, "_base_date_time_fcst",
                      return_value=("20260803", "1100")):
        result = weather_service._apply_air(_current(rain_prob=70), None, None, now=now)
    assert result.walk_index["level"] == "transit"
    assert "강수확률 70%" in result.walk_index["reason"]
    assert result.walk_index["source_label"] == "11:00 발표 단기예보 기준"
