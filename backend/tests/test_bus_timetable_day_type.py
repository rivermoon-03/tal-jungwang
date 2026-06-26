"""3400 토/일 탭 빈 시간표 회귀 방지.

버그: /timetable-by-route 엔드포인트가 프론트가 보내는 schedule_type을 무시하고
항상 오늘 날짜로 day_type을 계산했다. 그래서 평일에 토/일 탭을 누르면
백엔드가 weekday 데이터를 schedule_type="weekday"로 돌려주고,
프론트 어댑터는 그것을 timetable.weekday에만 채워 timetable.saturday는 비어
화면이 빈 시간표로 보였다.

수정: get_timetable/get_timetable_by_route_number에 day_type 오버라이드를 받아
명시되면 날짜 대신 그것으로 조회하도록 한다.
"""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class _FakeRoute:
    def __init__(self):
        self.id = 1
        self.route_number = "3400"
        self.route_name = None
        self.direction_name = "서울행"
        self.category = "하교"
        self.is_realtime = False
        self.gbis_route_id = None


def _make_db():
    """get_timetable 내부 3회 db.execute 호출에 대한 가짜 결과를 순서대로 제공."""
    route = _FakeRoute()

    route_result = MagicMock()
    route_result.scalar_one_or_none = MagicMock(return_value=route)

    entries_result = MagicMock()
    entries_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))

    origin_result = MagicMock()
    origin_result.scalar_one_or_none = MagicMock(return_value="한국공학대학교 시흥터미널")

    db = MagicMock()
    db.execute = AsyncMock(side_effect=[route_result, entries_result, origin_result])
    return db


@pytest.mark.asyncio
async def test_get_timetable_honors_day_type_override():
    """평일(d=금요일)이라도 day_type='saturday'를 주면 토요일로 조회해야 한다."""
    from app.services import bus as bus_mod

    weekday = date(2026, 6, 26)  # 금요일

    with patch.object(bus_mod, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(bus_mod, "set_cached_json", AsyncMock()):
        result = await bus_mod.get_timetable(
            _make_db(), route_id=1, d=weekday, day_type="saturday"
        )

    assert result is not None
    assert result["schedule_type"] == "saturday"


@pytest.mark.asyncio
async def test_get_timetable_falls_back_to_date_when_no_override():
    """day_type 미지정 시 기존 동작(날짜로 계산) 유지 — 금요일이면 weekday."""
    from app.services import bus as bus_mod

    weekday = date(2026, 6, 26)  # 금요일

    with patch.object(bus_mod, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(bus_mod, "set_cached_json", AsyncMock()):
        result = await bus_mod.get_timetable(_make_db(), route_id=1, d=weekday)

    assert result is not None
    assert result["schedule_type"] == "weekday"


@pytest.mark.asyncio
async def test_get_timetable_by_route_number_threads_day_type():
    """route_number 경로도 day_type을 get_timetable까지 전달해야 한다."""
    from app.services import bus as bus_mod

    route = _FakeRoute()
    routes_result = MagicMock()
    routes_result.scalars = MagicMock(
        return_value=MagicMock(all=MagicMock(return_value=[route]))
    )
    db = MagicMock()
    db.execute = AsyncMock(side_effect=[routes_result])

    captured = {}

    async def _fake_get_timetable(db, route_id, d, *, stop_id=None, day_type=None):
        captured["day_type"] = day_type
        return {"schedule_type": day_type}

    with patch.object(bus_mod, "get_timetable", _fake_get_timetable):
        await bus_mod.get_timetable_by_route_number(
            db, "3400", date(2026, 6, 26), day_type="sunday"
        )

    assert captured["day_type"] == "sunday"
