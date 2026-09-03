"""get_timetable의 is_realtime이 노선 단위가 아니라 방면(route_id) 단위여야 한다.

버그: route.is_realtime은 gbis_route_id 존재 여부만 본다. 3400/6502처럼 같은
gbis_route_id를 등교/하교가 공유하는 노선은 한쪽 방면(예: 3400 등교)에 실제
실시간 정보 source가 전혀 없어도 is_realtime=True로 응답했다. 그 결과
RouteDetailPage가 혼잡도/과거 도착 기록 섹션을 시간표 전용 방면에서도 그대로
렌더했다.

수정: get_timetable이 route.is_realtime 대신 _route_has_realtime_source로
bus_commute_contexts/bus_information_sources를 직접 확인해 이 route_id에
realtime 타입 source가 하나라도 있는지로 is_realtime을 계산한다.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class _FakeRoute:
    def __init__(self, *, route_id: int, category: str, gbis_route_id: str | None):
        self.id = route_id
        self.route_number = "3400"
        self.route_name = None
        self.direction_name = "학교행"
        self.category = category
        self.gbis_route_id = gbis_route_id

    @property
    def is_realtime(self) -> bool:
        return self.gbis_route_id is not None


def _make_db(route, *, has_realtime_source: bool):
    route_result = MagicMock()
    route_result.scalar_one_or_none = MagicMock(return_value=route)

    entries_result = MagicMock()
    entries_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))

    origin_result = MagicMock()
    origin_result.scalar_one_or_none = MagicMock(return_value="시화터미널")

    realtime_source_result = MagicMock()
    realtime_source_result.scalar_one_or_none = MagicMock(
        return_value=1 if has_realtime_source else None
    )

    db = MagicMock()
    db.execute = AsyncMock(
        side_effect=[route_result, entries_result, origin_result, realtime_source_result]
    )
    return db


@pytest.mark.asyncio
async def test_get_timetable_is_realtime_false_when_route_has_gbis_id_but_no_realtime_source():
    """3400 등교처럼 gbis_route_id는 있지만 이 방면에 realtime source가 없으면
    is_realtime은 False여야 한다(노선 단위 gbis_route_id를 그대로 쓰면 안 됨)."""
    from app.services import bus as bus_mod

    route = _FakeRoute(route_id=8, category="등교", gbis_route_id="224000050")
    assert route.is_realtime is True  # 노선 단위 플래그는 여전히 True(대조군)

    with patch.object(bus_mod, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(bus_mod, "set_cached_json", AsyncMock()):
        result = await bus_mod.get_timetable(
            _make_db(route, has_realtime_source=False), route_id=8, d=__import__("datetime").date(2026, 9, 1)
        )

    assert result["is_realtime"] is False


@pytest.mark.asyncio
async def test_get_timetable_is_realtime_true_when_route_has_realtime_source():
    """3400 하교처럼 realtime source가 있으면 is_realtime은 True."""
    from app.services import bus as bus_mod

    route = _FakeRoute(route_id=1, category="하교", gbis_route_id="224000050")

    with patch.object(bus_mod, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(bus_mod, "set_cached_json", AsyncMock()):
        result = await bus_mod.get_timetable(
            _make_db(route, has_realtime_source=True), route_id=1, d=__import__("datetime").date(2026, 9, 1)
        )

    assert result["is_realtime"] is True


@pytest.mark.asyncio
async def test_route_has_realtime_source_queries_by_route_id_and_source_type():
    from app.services.bus import _route_has_realtime_source

    exists_result = MagicMock()
    exists_result.scalar_one_or_none = MagicMock(return_value=42)
    db = MagicMock()
    db.execute = AsyncMock(return_value=exists_result)

    has_source = await _route_has_realtime_source(db, route_id=10)

    assert has_source is True
    db.execute.assert_awaited_once()
