"""버스 만차·결행 신호 제보(구 F6) 제거 회귀 테스트.

제출 경로와 조회 경로를 2026-09에 모두 걷어냈다. 조회는 BusPanel 이 도착 카드
경고 뱃지로 쓰던 것인데, 제출이 사라져 항상 빈 목록만 돌려주는 상태였다.
호출되지 않는 코드를 남기지 않으려고 소비처까지 함께 정리했다.
아래 테스트는 이 기능이 다시 들어오면 실패하도록 고정한다.
"""
from unittest.mock import AsyncMock, patch

import fakeredis
import pytest
from pydantic import ValidationError

from app.core import cache as cache_mod
from app.schemas.report import ReportCreate
from app.services import report as report_service


@pytest.fixture
def fake_redis():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


def test_bus_full_카테고리는_더_이상_유효하지_않다():
    with pytest.raises(ValidationError):
        ReportCreate(
            category="bus_full", message="만차로 지나갔어요", route_no="20-1", station_key="219000000"
        )


def test_bus_no_show_카테고리는_더_이상_유효하지_않다():
    with pytest.raises(ValidationError):
        ReportCreate(category="bus_no_show", message="시간 지나도 안 와요")


def test_route_no_station_key_필드는_스키마에서_사라졌다():
    payload = ReportCreate(category="route_error", message="노선 안내가 잘못됐어요")
    assert not hasattr(payload, "route_no")
    assert not hasattr(payload, "station_key")


@pytest.mark.asyncio
async def test_일반_제보는_redis_카운터를_남기지_않는다(fake_redis):
    """신호 기록 로직(_record_bus_signal)을 제거했으므로 어떤 제보도 카운터를 쌓지 않는다."""
    payload = ReportCreate(category="route_error", message="노선 안내가 잘못됐어요")

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        await report_service.submit_report(payload)
        keys = [key async for key in fake_redis.scan_iter(match="report:bus:*")]

    assert keys == []


def test_조회_경로도_함께_사라졌다():
    """get_active_bus_reports 는 소비처(BusPanel)까지 정리하며 같이 걷어냈다."""
    assert not hasattr(report_service, "get_active_bus_reports")
    assert not hasattr(report_service, "_STATION_KEY_RE")


def test_active_라우트가_더_이상_없다():
    """GET /api/v1/report/active 는 제거됐다. 남은 라우트는 제보 제출뿐이다."""
    from app.api import report as report_api

    paths = {route.path for route in report_api.router.routes}
    assert "/api/v1/report/active" not in paths
    assert "/api/v1/report" in paths
