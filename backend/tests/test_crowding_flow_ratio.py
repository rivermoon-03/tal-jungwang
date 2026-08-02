"""혼잡도 곡선이 평균이 아니라 "혼잡(>=3) 비율"을 내보내는지.

평균은 하한이 1이라 값 1인 버스와 3인 버스가 섞이면 2("보통")가 되어 실제로 존재한
어떤 버스도 설명하지 못한다. 시흥33 하교 17시가 실측 2.402(>=3 비율 46.6%)인데
화면에서 "보통"으로 보이던 원인이다.
(docs/superpowers/specs/2026-08-02-bus-crowding-thresholds-design.md §1)
"""

import pytest

from app.services.crowding_flow import build_points


def _row(bucket, c1=0, c2=0, c3=0, c4=0, days=10, avg=None):
    total = c1 + c2 + c3 + c4
    return {
        "bucket": bucket,
        "avg_crowded": avg if avg is not None else (
            (c1 + 2 * c2 + 3 * c3 + 4 * c4) / total if total else 1.0
        ),
        "sample_size": total,
        "sample_days": days,
        "c1": c1, "c2": c2, "c3": c3, "c4": c4,
    }


class TestRatio:
    def test_ratio_is_share_of_level_three_or_above(self):
        # 시흥33 하교 17시 실측 비율에 해당하는 분포
        points = build_points([_row(34, c1=24, c2=101, c3=100, c4=9)])
        assert points[0]["ratio"] == pytest.approx(109 / 234, abs=1e-6)

    def test_all_easy_is_zero_ratio(self):
        points = build_points([_row(10, c1=50)])
        assert points[0]["ratio"] == 0.0

    def test_bucket_maps_to_hour_and_minute(self):
        points = build_points([_row(35, c1=10)])
        assert (points[0]["hour"], points[0]["minute"]) == (17, 30)

    def test_missing_distribution_yields_null_ratio(self):
        """마이그레이션 직후 c1..c4 가 NULL 인 행. 평균으로 추정하지 않는다."""
        row = _row(20, c1=10)
        row.update(c1=None, c2=None, c3=None, c4=None)
        points = build_points([row])
        assert points[0]["ratio"] is None
        assert points[0]["samples"] == 0

    def test_avg_is_still_exposed_for_compatibility(self):
        points = build_points([_row(12, c1=1, c3=1)])
        assert points[0]["crowded"] == pytest.approx(2.0)


class TestCalibration:
    def test_floor_lifts_ratio_to_full_when_observation_is_low(self):
        """시흥1 하교 이마트 평일 16~19시: 관측은 거의 전부 1이지만 현장은 만차."""
        from app.services.crowding_calibration import CalibrationRule

        rule = CalibrationRule(
            route_id=4, stop_id=2, day_type="weekday",
            hour_from=16, hour_to=19, min_level=3, reason="현장 관측",
        )
        points = build_points(
            [_row(34, c1=300, c2=25, c3=4, c4=1)],
            rules=[rule], route_id=4, stop_id=2, day_type="weekday",
        )
        assert points[0]["ratio"] == 1.0
        assert points[0]["estimated"] is True

    def test_outside_window_keeps_observation(self):
        from app.services.crowding_calibration import CalibrationRule

        rule = CalibrationRule(
            route_id=4, stop_id=2, day_type="weekday",
            hour_from=16, hour_to=19, min_level=3, reason="현장 관측",
        )
        points = build_points(
            [_row(20, c1=90, c3=10)],  # bucket 20 = 10시
            rules=[rule], route_id=4, stop_id=2, day_type="weekday",
        )
        assert points[0]["ratio"] == pytest.approx(0.1)
        assert points[0]["estimated"] is False

    def test_no_rules_marks_nothing_estimated(self):
        points = build_points([_row(34, c1=10, c3=10)])
        assert points[0]["estimated"] is False
