"""F6 만차·결행 신호 제보 — Redis 카운터 + 활성 조회."""
from unittest.mock import AsyncMock, patch

import fakeredis
import pytest

from app.core import cache as cache_mod
from app.schemas.report import ReportCreate
from app.services import report as report_service


@pytest.fixture
def fake_redis():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


@pytest.mark.asyncio
async def test_만차_제보가_카운터에_쌓이고_활성_조회에_보인다(fake_redis):
    payload = ReportCreate(
        category="bus_full",
        message="만차로 지나갔어요",
        route_no="20-1",
        station_key="219000000",
    )

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        await report_service.submit_report(payload)
        await report_service.submit_report(payload)
        items = await report_service.get_active_bus_reports("219000000")

    assert len(items) == 1
    assert items[0]["route_no"] == "20-1"
    assert items[0]["kind"] == "bus_full"
    assert items[0]["count"] == 2
    assert items[0]["minutes_ago"] == 0


@pytest.mark.asyncio
async def test_컨텍스트_없는_일반_제보는_카운터를_건드리지_않는다(fake_redis):
    payload = ReportCreate(category="other", message="기타 제보")

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        await report_service.submit_report(payload)
        items = await report_service.get_active_bus_reports("219000000")

    assert items == []


@pytest.mark.asyncio
async def test_다른_정류장_신호는_섞이지_않는다(fake_redis):
    a = ReportCreate(category="bus_no_show", message="안 와요", route_no="11-A", station_key="A")
    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        await report_service.submit_report(a)
        assert await report_service.get_active_bus_reports("B") == []
        items = await report_service.get_active_bus_reports("A")
    assert items[0]["kind"] == "bus_no_show"
