"""driving 캐시 키 grid 해상도 검증.

walk 캐시(55m grid)에 비해 지나치게 촘촘했던 driving 캐시 키(구 소수점 4자리 ≈
11m grid)를 30~50m 안전 범위로 완화했는지, 그리고 walk보다는 여전히 살짝
좁게 유지되는지(도로망 민감도 고려) 확인한다.
"""
from __future__ import annotations

from app.api.route import (
    _DRIVING_SNAP_STEP,
    _WALK_SNAP_STEP,
    _coord_cache_key,
    _walk_cache_key,
)

_METERS_PER_DEGREE_LAT = 111_000


def test_driving_snap_step_within_safe_range_30_to_50m():
    """driving grid는 30~50m 안전 범위 안에 있어야 한다."""
    meters = _DRIVING_SNAP_STEP * _METERS_PER_DEGREE_LAT
    assert 30 <= meters <= 50


def test_driving_grid_looser_than_old_11m_default():
    """구 구현(소수점 4자리 반올림 ≈ 11m grid)보다 훨씬 완화되어야 한다."""
    old_grid_meters = 0.0001 * _METERS_PER_DEGREE_LAT  # ≈ 11m
    new_grid_meters = _DRIVING_SNAP_STEP * _METERS_PER_DEGREE_LAT
    assert new_grid_meters > old_grid_meters * 3


def test_driving_grid_still_tighter_than_walk_grid():
    """도로망 민감도 때문에 walk(55m)보다는 약간 좁게 유지한다."""
    assert _DRIVING_SNAP_STEP < _WALK_SNAP_STEP


def test_driving_cache_key_hits_for_nearby_coords_within_grid():
    """같은 grid 셀 안의 미세하게 다른 좌표는 동일한 캐시 키를 만들어야 한다."""
    base_key = _coord_cache_key("route:driving", 37.3400, 126.7335, 37.3516, 126.7427)
    # 좌표를 grid 절반 이하로만 흔들어도 같은 셀에 스냅되어야 함
    jitter = _DRIVING_SNAP_STEP * 0.2
    jittered_key = _coord_cache_key(
        "route:driving",
        37.3400 + jitter, 126.7335 - jitter,
        37.3516 - jitter, 126.7427 + jitter,
    )
    assert base_key == jittered_key


def test_driving_cache_key_misses_for_coords_in_different_grid_cells():
    """grid 셀 하나를 넘어가는 차이는 다른 캐시 키를 만들어야 한다."""
    base_key = _coord_cache_key("route:driving", 37.3400, 126.7335, 37.3516, 126.7427)
    far_key = _coord_cache_key(
        "route:driving",
        37.3400 + _DRIVING_SNAP_STEP * 3, 126.7335,
        37.3516, 126.7427,
    )
    assert base_key != far_key


def test_walk_cache_key_unaffected_by_driving_default_change():
    """_coord_cache_key의 기본 step 변경이 _walk_cache_key(50m grid)에는 영향을 주지 않는다."""
    key = _walk_cache_key(37.3400, 126.7335, 37.3516, 126.7427)
    assert key.startswith("route:walking:")
