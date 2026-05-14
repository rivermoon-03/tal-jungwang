import pytest
from app.services.bus import (
    apply_safety_margin,
    SAFETY_MIN_SEC,
    SAFETY_MAX_SEC,
    SAFETY_RATIO,
)


def test_constants_match_spec():
    assert SAFETY_RATIO == 0.20
    assert SAFETY_MIN_SEC == 30
    assert SAFETY_MAX_SEC == 150


def test_none_passthrough():
    assert apply_safety_margin(None) is None


def test_zero_passthrough():
    assert apply_safety_margin(0) == 0


def test_negative_passthrough():
    assert apply_safety_margin(-5) == -5


@pytest.mark.parametrize(
    "raw, expected",
    [
        (60, 30),
        (120, 90),
        (180, 144),
        (300, 240),
        (600, 480),
        (900, 750),
        (9000, 8850),
    ],
)
def test_margin_application(raw, expected):
    assert apply_safety_margin(raw) == expected


def test_never_below_zero():
    assert apply_safety_margin(1) == 0
    assert apply_safety_margin(10) >= 0
    assert apply_safety_margin(29) >= 0
