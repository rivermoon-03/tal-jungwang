"""`_traffic_ttl`의 러시아워/평시 경계 clamp 검증.

캐시 저장 시점의 러시/평시 판정만으로 TTL을 고정하면, 경계 직전에 저장된
캐시가 경계를 넘어서도 그대로 유지되어 최대 5분간 stale해지는 문제가 있었다.
`_traffic_ttl(now)`가 "다음 경계까지 남은 시간"과 기존 TTL 중 더 짧은 쪽을
쓰는지 확인한다.
"""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from app.api.traffic import (
    _TRAFFIC_NORMAL_TTL,
    _TRAFFIC_RUSH_TTL,
    _traffic_ttl,
)

_KST = ZoneInfo("Asia/Seoul")


def _kst(hour: int, minute: int, second: int = 0) -> datetime:
    return datetime(2026, 7, 17, hour, minute, second, tzinfo=_KST)


def test_normal_hour_far_from_boundary_uses_full_normal_ttl():
    """평시 구간 한가운데(경계와 멀리 떨어짐)는 기존 정책대로 300초."""
    assert _traffic_ttl(_kst(13, 0)) == _TRAFFIC_NORMAL_TTL


def test_rush_hour_far_from_boundary_uses_full_rush_ttl():
    """러시아워 구간 한가운데는 기존 정책대로 60초."""
    assert _traffic_ttl(_kst(8, 0)) == _TRAFFIC_RUSH_TTL


def test_normal_ttl_clamped_right_before_rush_boundary():
    """06:59:00 저장 캐시는 07:00 러시아워 진입까지 60초만 남았으므로
    300초가 아니라 60초로 clamp되어야 한다(경계를 넘어 stale해지는 것 방지)."""
    ttl = _traffic_ttl(_kst(6, 59, 0))
    assert ttl == 60
    assert ttl < _TRAFFIC_NORMAL_TTL


def test_rush_ttl_clamped_right_before_normal_boundary():
    """09:59:30 저장 캐시는 60초 TTL이지만 10:00 평시 전환까지 30초밖에
    안 남았으므로 30초로 clamp되어야 한다."""
    ttl = _traffic_ttl(_kst(9, 59, 30))
    assert ttl == 30
    assert ttl <= _TRAFFIC_RUSH_TTL


def test_evening_rush_boundary_clamp():
    """15:59:00 저장 캐시는 16:00 저녁 러시 진입까지 60초 남아 clamp된다."""
    assert _traffic_ttl(_kst(15, 59, 0)) == 60


def test_midnight_wraparound_boundary_is_next_day_07():
    """23:00 저장 캐시는 자정을 넘어 다음날 07:00까지가 다음 경계이므로
    평시 TTL(300초)이 그대로 적용되어야 한다(wraparound에서 clamp가 지나치게
    짧아지지 않아야 함)."""
    assert _traffic_ttl(_kst(23, 0)) == _TRAFFIC_NORMAL_TTL


def test_exact_boundary_moment_uses_new_regime_and_next_boundary():
    """정확히 07:00:00에는 이미 러시아워 판정이며, 다음 경계는 10:00까지 3시간
    남았으므로 clamp 없이 러시 TTL(60초) 그대로 적용된다."""
    assert _traffic_ttl(_kst(7, 0, 0)) == _TRAFFIC_RUSH_TTL


def test_ttl_never_zero_or_negative():
    """경계에 거의 딱 붙어도(1초 전) TTL은 최소 1초 이상이어야 한다."""
    ttl = _traffic_ttl(_kst(6, 59, 59))
    assert ttl >= 1
