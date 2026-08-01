import pytest

from app.models.bus import BusRealtimeTarget, BusRoute, BusStop
from app.services.bus_collector import _load_realtime_stations
from app.schemas.bus import BusArrival


class _ScalarResult:
    def __init__(self, values):
        self._values = values

    def scalars(self):
        return self

    def all(self):
        return self._values


class _DB:
    def __init__(self, values):
        self._values = values

    async def execute(self, _stmt):
        return _ScalarResult(self._values)


@pytest.mark.asyncio
async def test_realtime_loader_uses_explicit_target_and_direction():
    route = BusRoute(
        id=7,
        route_number="3401",
        category="하교",
        direction_name="서울행",
        gbis_route_id="224000071",
    )
    stop = BusStop(
        id=18,
        name="시흥시청역(서울방향)",
        gbis_station_id="224000538",
        lat=37.381656,
        lng=126.805878,
    )
    target = BusRealtimeTarget(
        bus_route_id=7,
        bus_stop_id=18,
        travel_direction="to-seoul",
        enabled=True,
    )
    target.route = route
    target.stop = stop

    loaded = await _load_realtime_stations(_DB([target]))

    assert loaded == [
        {
            "stop_id": 18,
            "stop_name": "시흥시청역(서울방향)",
            "gbis_station_id": "224000538",
            "routes": {"224000071": route},
            "travel_directions": {"224000071": "to-seoul"},
        }
    ]


@pytest.mark.asyncio
async def test_realtime_loader_does_not_infer_6502_from_gbis_route_id():
    # 명시 target이 하나도 없으면 route의 gbis_route_id 존재 여부와 무관하게 수집하지 않는다.
    loaded = await _load_realtime_stations(_DB([]))

    assert loaded == []


def test_arrival_schema_exposes_observation_travel_direction():
    arrival = BusArrival(
        route_id=7,
        route_no="3401",
        category="하교",
        arrival_type="realtime",
        travel_direction="to-seoul",
    )

    assert arrival.model_dump()["travel_direction"] == "to-seoul"
