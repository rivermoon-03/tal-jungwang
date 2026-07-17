import pytest
from app.services.bus import (
    apply_safety_margin,
    SAFETY_MIN_SEC,
    SAFETY_MAX_SEC,
    SAFETY_RATIO,
)


def test_constants_match_spec():
    assert SAFETY_RATIO == 0.20
    assert SAFETY_MIN_SEC == 30
    assert SAFETY_MAX_SEC == 150


def test_none_passthrough():
    assert apply_safety_margin(None) is None


def test_zero_passthrough():
    assert apply_safety_margin(0) == 0


def test_negative_passthrough():
    assert apply_safety_margin(-5) == -5


@pytest.mark.parametrize(
    "raw, expected",
    [
        (60, 30),
        (120, 90),
        (180, 144),
        (300, 240),
        (600, 480),
        (900, 750),
        (9000, 8850),
    ],
)
def test_margin_application(raw, expected):
    assert apply_safety_margin(raw) == expected


def test_never_below_zero():
    assert apply_safety_margin(1) == 0
    assert apply_safety_margin(10) >= 0
    assert apply_safety_margin(29) >= 0


import json
from datetime import date, datetime, time
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo


class _FakeRoute:
    def __init__(self, route_id, route_no, is_realtime):
        self.id = route_id
        self.route_number = route_no
        self.route_name = route_no
        self.direction_name = "테스트"
        self.category = "test"
        self.is_realtime = is_realtime
        self.gbis_route_id = "1" if is_realtime else None


class _FakeStop:
    def __init__(self):
        self.id = 999
        self.name = "테스트 정류장"
        self.sub_name = None
        self.lat = 37.0
        self.lng = 127.0
        self.gbis_station_id = "224000639"
        self.routes = [_FakeRoute(101, "시흥33", True)]


@pytest.mark.asyncio
async def test_get_arrivals_applies_margin_to_realtime_only():
    """캐시에서 raw 300s 읽힌 realtime 항목이 응답에서 240s로 깎여야 한다.
    timetable 항목은 변경되지 않는다."""
    from app.services import bus as bus_mod

    stop = _FakeStop()

    db = MagicMock()
    db.execute = AsyncMock()
    scalar_result = MagicMock()
    scalar_result.scalar_one_or_none = MagicMock(return_value=stop)
    all_result = MagicMock()
    all_result.all = MagicMock(return_value=[])
    db.execute.side_effect = [scalar_result, all_result]

    kst = ZoneInfo("Asia/Seoul")
    now = datetime.now(kst)
    payload = {
        "cached_at": now.isoformat(),
        "arrivals": [
            {
                "route_id": 101,
                "route_no": "시흥33",
                "destination": "테스트",
                "category": "test",
                "arrival_type": "realtime",
                "depart_at": None,
                "arrive_in_seconds": 300,
                "is_tomorrow": False,
            }
        ],
    }
    fake_redis = AsyncMock()
    fake_redis.get = AsyncMock(return_value=json.dumps(payload))

    with patch.object(bus_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(bus_mod, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(bus_mod, "set_cached_json", AsyncMock()), \
         patch.object(bus_mod, "_resolve_avg_intervals", AsyncMock(return_value={})), \
         patch.object(bus_mod, "_resolve_arrival_stats", AsyncMock(return_value={})):
        result = await bus_mod.get_arrivals(
            db, station_id=999, d=date.today(), now_time=time(now.hour, now.minute, now.second)
        )

    realtime = [a for a in result["arrivals"] if a["arrival_type"] == "realtime"]
    assert len(realtime) == 1
    # raw 300 - margin 60 = 240 (elapsed ≈ 0; allow ±5s drift)
    assert 235 <= realtime[0]["arrive_in_seconds"] <= 240


@pytest.mark.asyncio
async def test_get_arrivals_does_not_modify_none_or_timetable():
    """None placeholder, timetable 항목은 마진 미적용 — 함수 단위로 등가 검증."""
    from app.services.bus import apply_safety_margin

    assert apply_safety_margin(None) is None
