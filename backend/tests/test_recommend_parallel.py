"""P2-12: /transport 외부 호출 병렬화 검증.

`recommend_transport` 가 호출되면 `get_arrivals` 와 `_get_traffic_label`
두 코루틴이 거의 동시에 시작되어야 한다 (둘 다 입력 의존성 없음).

기존 순차 흐름이면 traffic_label 은 함수 끝부분에서 시작되어
`arrivals_start + arrivals_duration + ride_duration` 후에 호출된다.
병렬화 후엔 두 호출이 거의 동시(±50ms) 에 시작되어야 한다.
"""

import asyncio
import time as time_module
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from fastapi import Response

from app.api import recommend as recommend_mod


class _FakeBusStop:
    id = 3
    lat = 37.339343
    lng = 126.73279


def _make_request() -> "Request":
    """slowapi.Limiter 가 isinstance(Request) 체크하므로 진짜 Starlette Request 가 필요."""
    from starlette.requests import Request

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/recommend/transport",
        "headers": [],
        "query_string": b"",
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
        "scheme": "http",
        "root_path": "",
        "app": None,
    }
    return Request(scope)


def _fake_db_execute_returning_busstop():
    """db.execute() 를 mock 해서 BusStop row 를 돌려준다."""
    scalar_result = MagicMock()
    scalar_result.scalar_one_or_none = MagicMock(return_value=_FakeBusStop())
    return AsyncMock(return_value=scalar_result)


@pytest.mark.asyncio
async def test_recommend_transport_starts_traffic_label_and_arrivals_in_parallel():
    """병렬화 검증: traffic_label 호출 시작 시각이 arrivals 시작 직후여야 한다."""

    call_times: dict[str, float] = {}

    async def fake_get_arrivals(db, stop_id, d, t):
        call_times["arrivals_start"] = time_module.perf_counter()
        await asyncio.sleep(0.3)
        return {
            "arrivals": [
                {"route_no": "5200", "arrive_in_seconds": 60},
            ],
        }

    async def fake_get_traffic_label():
        call_times["traffic_start"] = time_module.perf_counter()
        await asyncio.sleep(0.3)
        return None  # 원활 → prefix 없음

    async def fake_get_bus_ride_seconds(stop_lat, stop_lng):
        call_times["ride_start"] = time_module.perf_counter()
        await asyncio.sleep(0.5)
        return 600

    db = MagicMock()
    db.execute = _fake_db_execute_returning_busstop()

    with patch.object(recommend_mod, "get_arrivals", side_effect=fake_get_arrivals), \
         patch.object(recommend_mod, "_get_traffic_label", side_effect=fake_get_traffic_label), \
         patch.object(recommend_mod, "_get_bus_ride_seconds", side_effect=fake_get_bus_ride_seconds):
        start = time_module.perf_counter()
        # recommend_transport 는 limiter 데코레이터가 wraps 했지만,
        # slowapi.Limiter 는 isinstance(Request) 체크. 진짜 Starlette Request 를
        # 직접 만들어 데코레이터가 받아들이도록 한다.
        result = await recommend_mod.recommend_transport(
            request=_make_request(),
            response=Response(),
            origin_lat=37.34,
            origin_lng=126.73,
            db=db,
        )
        end = time_module.perf_counter()

    # --- 시작 시각 검증: 두 호출이 거의 동시에 시작되어야 한다 ---
    assert "arrivals_start" in call_times
    assert "traffic_start" in call_times
    delta = abs(call_times["traffic_start"] - call_times["arrivals_start"])
    assert delta < 0.05, (
        f"traffic_label 과 get_arrivals 가 병렬로 시작되지 않음 "
        f"(시작 시각 차 {delta:.3f}s, 기대 < 0.05s)"
    )

    # --- wall-clock 검증: 순차였다면 0.3 + 0.5 + 0.3 = 1.1s.
    # 병렬화 후엔 max(traffic 0.3s, arrivals 0.3s + ride 0.5s) = 0.8s 정도. ---
    duration = end - start
    print(
        f"\n[P2-12] traffic-arrivals start delta = {delta*1000:.1f}ms, "
        f"total wall-time = {duration*1000:.1f}ms "
        f"(순차 흐름 기대치 ≈ 1100ms)"
    )
    assert duration < 1.0, f"병렬화 효과 부족: 총 {duration:.3f}s (기대 < 1.0s)"

    # --- 응답 shape 검증 (ApiResponse[RecommendResponse]) ---
    payload = result.data
    assert payload.recommended in {"walking", "bus"}
    bus_cmp = payload.comparison["bus"]
    walk_cmp = payload.comparison["walking"]
    assert bus_cmp.available is True
    assert bus_cmp.route_no == "5200"
    assert bus_cmp.wait_seconds == 60
    assert bus_cmp.ride_seconds == 600
    assert bus_cmp.total_seconds == 660
    assert walk_cmp.total_seconds == 1200
    assert payload.updated_at


@pytest.mark.asyncio
async def test_recommend_transport_traffic_label_prefix_included():
    """traffic_label 이 반환되면 메시지 앞에 prefix 가 붙는다."""

    async def fake_get_arrivals(db, stop_id, d, t):
        return {
            "arrivals": [
                {"route_no": "5200", "arrive_in_seconds": 60},
            ],
        }

    async def fake_get_traffic_label():
        return "정체"

    async def fake_get_bus_ride_seconds(stop_lat, stop_lng):
        return 600

    db = MagicMock()
    db.execute = _fake_db_execute_returning_busstop()

    with patch.object(recommend_mod, "get_arrivals", side_effect=fake_get_arrivals), \
         patch.object(recommend_mod, "_get_traffic_label", side_effect=fake_get_traffic_label), \
         patch.object(recommend_mod, "_get_bus_ride_seconds", side_effect=fake_get_bus_ride_seconds):
        result = await recommend_mod.recommend_transport(
            request=_make_request(),
            response=Response(),
            origin_lat=37.34,
            origin_lng=126.73,
            db=db,
        )

    payload = result.data
    assert payload.message.startswith("도로 정체 중 — ")


@pytest.mark.asyncio
async def test_recommend_transport_no_bus_arrivals_falls_back_to_walking():
    """버스 도착정보가 없으면 walking 으로 폴백, bus_ride_seconds 호출되지 않음."""

    ride_called = {"n": 0}

    async def fake_get_arrivals(db, stop_id, d, t):
        return {"arrivals": []}

    async def fake_get_traffic_label():
        return None

    async def fake_get_bus_ride_seconds(stop_lat, stop_lng):
        ride_called["n"] += 1
        return 600

    db = MagicMock()
    db.execute = _fake_db_execute_returning_busstop()

    with patch.object(recommend_mod, "get_arrivals", side_effect=fake_get_arrivals), \
         patch.object(recommend_mod, "_get_traffic_label", side_effect=fake_get_traffic_label), \
         patch.object(recommend_mod, "_get_bus_ride_seconds", side_effect=fake_get_bus_ride_seconds):
        result = await recommend_mod.recommend_transport(
            request=_make_request(),
            response=Response(),
            origin_lat=37.34,
            origin_lng=126.73,
            db=db,
        )

    payload = result.data
    assert payload.recommended == "walking"
    bus_cmp = payload.comparison["bus"]
    assert bus_cmp.available is False
    assert bus_cmp.total_seconds is None
    # 버스 도착 없음 → ride 호출 안 함
    assert ride_called["n"] == 0
