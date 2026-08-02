"""노선별 혼잡도 표시 보정.

GBIS crowded 가 현장과 어긋나는 조합(시흥1 하교 이마트)의 표시 하한을 DB에 두고
표시 시점에만 적용한다. 사람이 넣은 단언이므로 값을 실제로 올린 경우 estimated 로
표시해 센서 관측과 구분한다.
(docs/superpowers/specs/2026-08-02-bus-crowding-thresholds-design.md §5)
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.crowding_calibration import (
    CalibrationRule,
    apply_calibration,
    load_calibrations,
)


def _rule(**kw):
    base = dict(
        route_id=4,
        stop_id=2,
        day_type="weekday",
        hour_from=16,
        hour_to=19,
        min_level=3,
        reason="현장 관측",
    )
    base.update(kw)
    return CalibrationRule(**base)


class TestApplyCalibration:
    def test_raises_level_within_window(self):
        level, estimated = apply_calibration(
            1, [_rule()], route_id=4, stop_id=2, day_type="weekday", hour=17
        )
        assert (level, estimated) == (3, True)

    def test_does_not_lower_a_higher_observation(self):
        """하한이지 대입이 아니다. 실제로 4가 관측됐으면 4를 유지한다."""
        level, estimated = apply_calibration(
            4, [_rule()], route_id=4, stop_id=2, day_type="weekday", hour=17
        )
        assert (level, estimated) == (4, False)

    def test_equal_level_is_not_marked_estimated(self):
        """보정이 값을 바꾸지 않았으면 관측값 그대로다."""
        level, estimated = apply_calibration(
            3, [_rule()], route_id=4, stop_id=2, day_type="weekday", hour=17
        )
        assert (level, estimated) == (3, False)

    @pytest.mark.parametrize("hour", [15, 20])
    def test_outside_hour_window_is_untouched(self, hour):
        level, estimated = apply_calibration(
            1, [_rule()], route_id=4, stop_id=2, day_type="weekday", hour=hour
        )
        assert (level, estimated) == (1, False)

    @pytest.mark.parametrize("hour", [16, 19])
    def test_hour_window_is_inclusive_on_both_ends(self, hour):
        level, _ = apply_calibration(
            1, [_rule()], route_id=4, stop_id=2, day_type="weekday", hour=hour
        )
        assert level == 3

    def test_other_day_type_is_untouched(self):
        level, estimated = apply_calibration(
            1, [_rule()], route_id=4, stop_id=2, day_type="weekend", hour=17
        )
        assert (level, estimated) == (1, False)

    def test_other_route_or_stop_is_untouched(self):
        rules = [_rule()]
        assert apply_calibration(1, rules, route_id=99, stop_id=2, day_type="weekday", hour=17) == (1, False)
        assert apply_calibration(1, rules, route_id=4, stop_id=99, day_type="weekday", hour=17) == (1, False)

    def test_null_stop_and_day_type_match_every_value(self):
        """NULL 축은 '전체'를 뜻한다."""
        rule = _rule(stop_id=None, day_type=None)
        level, _ = apply_calibration(
            1, [rule], route_id=4, stop_id=77, day_type="weekend", hour=18
        )
        assert level == 3

    def test_strongest_matching_rule_wins(self):
        rules = [_rule(min_level=2), _rule(min_level=4)]
        level, _ = apply_calibration(
            1, rules, route_id=4, stop_id=2, day_type="weekday", hour=17
        )
        assert level == 4

    def test_none_level_stays_none(self):
        """관측 자체가 없으면 보정도 하지 않는다 — 없는 값을 지어내지 않는다."""
        level, estimated = apply_calibration(
            None, [_rule()], route_id=4, stop_id=2, day_type="weekday", hour=17
        )
        assert (level, estimated) == (None, False)

    def test_empty_rules_is_identity(self):
        assert apply_calibration(2, [], route_id=4, stop_id=2, day_type="weekday", hour=17) == (2, False)


class TestLoadCalibrations:
    @pytest.mark.asyncio
    async def test_maps_rows_to_rules(self):
        row = SimpleNamespace(
            bus_route_id=4, bus_stop_id=2, day_type="weekday",
            hour_from=16, hour_to=19, min_level=3, reason="현장 관측",
        )
        scalars = MagicMock()
        scalars.all = MagicMock(return_value=[row])
        result = MagicMock()
        result.scalars = MagicMock(return_value=scalars)
        db = MagicMock()
        db.execute = AsyncMock(return_value=result)

        rules = await load_calibrations(db)

        assert rules == [_rule()]

    @pytest.mark.asyncio
    async def test_missing_table_degrades_to_no_rules(self):
        """마이그레이션 미적용 배포에서도 혼잡도 조회가 죽으면 안 된다."""
        from sqlalchemy.exc import ProgrammingError

        db = MagicMock()
        db.execute = AsyncMock(side_effect=ProgrammingError("stmt", {}, Exception("x")))
        db.rollback = AsyncMock()

        assert await load_calibrations(db) == []
        db.rollback.assert_awaited_once()
