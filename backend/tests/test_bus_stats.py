"""bus_stats 모듈의 순수 헬퍼 함수 단위 테스트.

refresh_all_stats / get_arrival_stats 의 DB·Redis 동작은 docker postgres에서
manual smoke test로 검증한다 (Task 16 verification). 여기서는 mock 없이
테스트 가능한 순수 함수만 다룬다.
"""
from datetime import datetime, timezone

import pytest

from app.services.bus_stats import (
    STATS_CACHE_PREFIX,
    STATS_CACHE_TTL,
    _cache_key,
    _row_to_payload,
    _sec_to_min,
)


def test_cache_key_format():
    assert _cache_key(12, 100, "weekday", 18) == "bus:stats:12:100:weekday:18"
    assert STATS_CACHE_PREFIX == "bus:stats"
    assert STATS_CACHE_TTL == 6 * 3600


@pytest.mark.parametrize(
    "sec, expected",
    [
        (0, 0),
        (29, 0),  # 30초 미만은 0분
        (30, 0),  # round(0.5) = 0 in banker's rounding, OK for our display
        (60, 1),
        (89, 1),
        (90, 2),  # round(1.5)=2 (banker: 2)
        (240, 4),
        (570, 10),  # 9.5분 -> round-half-to-even: 10
    ],
)
def test_sec_to_min(sec, expected):
    assert _sec_to_min(sec) == expected


def test_sec_to_min_clamps_negative_to_zero():
    # 음수 입력은 비정상이지만 안전하게 0 반환
    assert _sec_to_min(-100) == 0


def test_row_to_payload_full():
    row = {
        "p10_interval_sec": 60,
        "p50_interval_sec": 240,
        "p90_interval_sec": 540,
        "mean_interval_sec": 250,
        "sample_size": 28,
        "computed_at": datetime(2026, 5, 16, 3, 30, tzinfo=timezone.utc),
    }
    p = _row_to_payload(row)
    assert p["p10_min"] == 1
    assert p["p50_min"] == 4
    assert p["p90_min"] == 9
    assert p["mean_min"] == 4
    assert p["sample_size"] == 28
    # tolerance = round((9 - 1) / 2) = 4
    assert p["tolerance_min"] == 4
    assert p["computed_at"] == "2026-05-16T03:30:00+00:00"


def test_row_to_payload_zero_variance():
    # p10 == p90: tolerance should be 0, no crash
    row = {
        "p10_interval_sec": 240,
        "p50_interval_sec": 240,
        "p90_interval_sec": 240,
        "mean_interval_sec": 240,
        "sample_size": 12,
        "computed_at": None,
    }
    p = _row_to_payload(row)
    assert p["tolerance_min"] == 0
    assert p["p10_min"] == p["p50_min"] == p["p90_min"] == 4
    assert p["computed_at"] is None
