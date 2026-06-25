"""버스 폴링 hung 방지 타임아웃 회귀 테스트.

_bus_poll_job에 asyncio.wait_for(timeout=40)이 적용되어 있어,
GBIS 호출이 12초 이상 hung 되어도 잡이 max_instances deadlock에
빠지지 않고 자가복구되는지 검증한다.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_bus_poll_job_recovers_on_gbis_timeout():
    """GBIS fetch가 hung 되면 12초 타임아웃 후 해당 정류장을 skip한다."""

    async def slow_fetch(station_id):
        await asyncio.sleep(100)  # 영구 hung 시뮬레이션
        return []

    target = {
        "stop_id": 3,
        "stop_name": "한국공학대학교",
        "gbis_station_id": "224000639",
        "routes": {"224000062": MagicMock(
            id=2, route_number="시흥33", direction_name="시흥시청방면",
            category="하교", is_realtime=True,
        )},
    }

    redis_mock = AsyncMock()
    redis_mock.get = AsyncMock(return_value=None)
    redis_mock.set = AsyncMock()
    redis_mock.exists = AsyncMock(return_value=0)
    redis_mock.pipeline = MagicMock(return_value=AsyncMock(
        execute=AsyncMock(return_value=[]),
        __aenter__=AsyncMock(return_value=AsyncMock()),
        __aexit__=AsyncMock(return_value=None),
    ))

    import json
    from datetime import datetime
    from zoneinfo import ZoneInfo

    with (
        patch("app.services.bus_collector._load_realtime_stations", return_value=[target]),
        patch("app.services.bus_collector.fetch_arrivals", side_effect=slow_fetch),
        patch("app.services.bus_collector.get_redis", return_value=AsyncMock(return_value=redis_mock)),
        patch("app.services.bus_collector.AsyncSessionLocal"),
    ):
        from app.services.bus_collector import poll_and_collect

        # 개별 GBIS 호출에 12초 타임아웃이 적용되어야 하므로
        # 전체 poll_and_collect가 15초 안에 끝나야 한다 (타임아웃 후 skip).
        try:
            await asyncio.wait_for(poll_and_collect(), timeout=15)
        except asyncio.TimeoutError:
            pytest.fail(
                "poll_and_collect가 15초 안에 반환되지 않았다. "
                "GBIS 타임아웃 처리가 누락된 것으로 보인다."
            )


@pytest.mark.asyncio
async def test_bus_poll_job_scheduler_timeout():
    """_bus_poll_job이 40초 내에 완료되도록 wait_for가 적용되었는지 확인.

    실제로 scheduler.py의 _bus_poll_job에 asyncio.wait_for(timeout=40)이
    감싸져 있는지 코드 레벨 검증.
    """
    import inspect
    from app.core.scheduler import _bus_poll_job

    src = inspect.getsource(_bus_poll_job)
    assert "wait_for" in src, "_bus_poll_job에 asyncio.wait_for 타임아웃이 없다"
    assert "timeout=40" in src, "_bus_poll_job의 wait_for timeout이 40초로 설정되지 않았다"
