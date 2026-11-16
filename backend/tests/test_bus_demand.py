from datetime import datetime
from unittest.mock import AsyncMock, patch

import fakeredis
import pytest

from app.services import bus_demand
from app.services.bus_demand import demanded_ids, in_on_demand_window, mark_demand


def at(h: int, m: int = 0) -> datetime:
    return datetime(2026, 11, 17, h, m)


@pytest.mark.parametrize(
    ("now", "expected"),
    [(at(20, 59), False), (at(21, 0), True), (at(23, 30), True), (at(0, 40), True), (at(1, 30), False), (at(12), False)],
)
def test_window_wraps_past_midnight(now, expected):
    assert in_on_demand_window(now, "21:00", "01:30") is expected


def test_window_same_day():
    assert in_on_demand_window(at(10), "09:00", "11:00") is True
    assert in_on_demand_window(at(11), "09:00", "11:00") is False


@pytest.mark.anyio
async def test_only_marked_stations_are_demanded():
    fake = fakeredis.aioredis.FakeRedis(decode_responses=True)
    with patch.object(bus_demand, "get_redis", AsyncMock(return_value=fake)):
        await mark_demand("224000639")
        assert await demanded_ids(["224000639", "224000513"]) == {"224000639"}
        assert await fake.ttl("bus:demand:224000639") <= bus_demand.DEMAND_TTL
        assert await demanded_ids([]) == set()


@pytest.mark.anyio
async def test_mark_demand_swallows_redis_errors():
    with patch.object(bus_demand, "get_redis", AsyncMock(side_effect=ConnectionError("down"))):
        await mark_demand("224000639")
