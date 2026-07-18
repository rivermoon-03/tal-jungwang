"""날씨 서비스 — 풍속(WSD, '정왕풍') 파싱 검증.

초단기실황(ncst)의 WSD를 우선으로, 없으면 현재 시각 예보 슬롯의 WSD로 폴백하고,
값이 없거나 파싱 불가하면 None을 반환하는지 확인한다.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from app.services.weather import _build_current

_KST = ZoneInfo("Asia/Seoul")
_NOW = datetime(2026, 7, 18, 9, 30, tzinfo=_KST)
_CUR_KEY = ("20260718", "0900")  # _build_current이 참조하는 현재 시각 슬롯


def _base_fcst(extra: dict | None = None) -> dict:
    slot = {"TMP": "20", "SKY": "1", "PTY": "0", "POP": "0"}
    if extra:
        slot.update(extra)
    return {_CUR_KEY: slot}


def test_wind_speed_from_ncst():
    ncst = {"T1H": "24", "SKY": "1", "PTY": "0", "WSD": "3.4"}
    result = _build_current(ncst, _base_fcst(), _NOW)
    assert result.wind_speed == 3.4


def test_wind_speed_rounds_to_one_decimal():
    ncst = {"T1H": "24", "WSD": "3.47"}
    result = _build_current(ncst, _base_fcst(), _NOW)
    assert result.wind_speed == 3.5


def test_wind_speed_falls_back_to_forecast_slot():
    # 실황에 WSD 없음 → 현재 시각 예보 슬롯의 WSD 사용
    ncst = {"T1H": "24", "SKY": "1", "PTY": "0"}
    result = _build_current(ncst, _base_fcst({"WSD": "7.0"}), _NOW)
    assert result.wind_speed == 7.0


def test_wind_speed_none_when_absent_everywhere():
    ncst = {"T1H": "24", "SKY": "1", "PTY": "0"}
    result = _build_current(ncst, _base_fcst(), _NOW)
    assert result.wind_speed is None


def test_wind_speed_none_when_unparseable():
    ncst = {"T1H": "24", "WSD": "-"}
    result = _build_current(ncst, _base_fcst(), _NOW)
    assert result.wind_speed is None
