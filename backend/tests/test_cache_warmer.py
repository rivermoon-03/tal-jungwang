"""cache_warmer 단위 테스트.

service 함수는 모두 mock — warm_static이 (1) 각 항목을 호출하는지,
(2) 한 항목이 실패해도 나머지를 계속 적재하는지(격리), (3) 버스 시간표 조합을
DB에서 추려 get_timetable으로 적재하는지를 검증한다.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core import cache_warmer


def _db_with_combos(combos):
    """db.execute(...).all() 이 주어진 (route_id, stop_id) 조합을 돌려주는 mock db."""
    result = MagicMock()
    result.all.return_value = combos
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)
    return db


@pytest.mark.asyncio
async def test_warm_bus_timetables_warms_each_combo_and_all_variant():
    db = _db_with_combos([(1, 10), (1, 11), (2, 10)])

    with patch("app.services.bus.get_timetable", new=AsyncMock()) as gt, patch(
        "app.services.bus._day_type", return_value="weekday"
    ):
        warmed = await cache_warmer.warm_bus_timetables(db)

    # 3개 조합 + 노선별 'all' 2개(route 1, 2) = 5
    assert warmed == 5
    # stop_id 지정 호출 3건
    stop_calls = [c for c in gt.await_args_list if c.kwargs.get("stop_id") is not None]
    assert len(stop_calls) == 3
    # stop_id 미지정(all) 호출 2건 (route 1, 2)
    all_calls = [c for c in gt.await_args_list if "stop_id" not in c.kwargs]
    assert len(all_calls) == 2


@pytest.mark.asyncio
async def test_warm_bus_timetables_isolates_per_combo_failure():
    db = _db_with_combos([(1, 10), (2, 20)])

    async def _boom(db, route_id, d, *, stop_id=None):
        if route_id == 1 and stop_id == 10:
            raise RuntimeError("GBIS down")

    with patch("app.services.bus.get_timetable", new=AsyncMock(side_effect=_boom)), patch(
        "app.services.bus._day_type", return_value="weekday"
    ):
        warmed = await cache_warmer.warm_bus_timetables(db)

    # (1,10) 실패 → 나머지 (2,20) + all(route1) + all(route2) = 3 적재
    assert warmed == 3


@pytest.mark.asyncio
async def test_warm_static_calls_all_sources():
    db = _db_with_combos([])  # 버스 조합 없음

    with patch("app.services.shuttle.get_schedule", new=AsyncMock()) as shuttle, patch(
        "app.services.subway.get_timetable", new=AsyncMock()
    ) as subway, patch(
        "app.services.map_markers.get_markers", new=AsyncMock()
    ) as markers:
        summary = await cache_warmer.warm_static(db)

    shuttle.assert_awaited_once()
    subway.assert_awaited_once()
    markers.assert_awaited_once()
    assert summary["shuttle"] == "ok"
    assert summary["subway"] == "ok"
    assert summary["markers"] == "ok"
    assert summary["bus_timetables"] == 0


@pytest.mark.asyncio
async def test_warm_static_isolates_one_failure():
    db = _db_with_combos([])

    with patch("app.services.shuttle.get_schedule", new=AsyncMock()), patch(
        "app.services.subway.get_timetable", new=AsyncMock(side_effect=RuntimeError("boom"))
    ), patch("app.services.map_markers.get_markers", new=AsyncMock()) as markers:
        summary = await cache_warmer.warm_static(db)

    # 지하철이 터져도 마커는 적재된다.
    markers.assert_awaited_once()
    assert summary["subway"] == "error"
    assert summary["shuttle"] == "ok"
    assert summary["markers"] == "ok"
