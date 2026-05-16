"""한국 공휴일 기반 day_type 매핑 헬퍼 테스트."""
from datetime import date

from app.core.calendar import get_day_type, get_holiday_name, is_holiday


# ── get_day_type ─────────────────────────────────────────────


def test_평일은_weekday():
    # 2026-05-13(수) — 일반 평일, 공휴일 아님
    assert get_day_type(date(2026, 5, 13)) == "weekday"


def test_토요일은_saturday():
    # 2026-05-09 토요일
    assert get_day_type(date(2026, 5, 9)) == "saturday"


def test_일요일은_sunday():
    # 2026-05-10 일요일
    assert get_day_type(date(2026, 5, 10)) == "sunday"


def test_평일에_있는_공휴일은_sunday로_매핑():
    # 2026-05-05 어린이날 — 화요일 (평일 weekday)
    assert get_day_type(date(2026, 5, 5)) == "sunday"


def test_금요일_공휴일도_sunday로_매핑():
    # 2026-10-09 한글날 — 금요일
    assert get_day_type(date(2026, 10, 9)) == "sunday"


# ── get_holiday_name ─────────────────────────────────────────


def test_공휴일_이름_반환():
    name = get_holiday_name(date(2026, 5, 5))
    assert name is not None
    assert "어린이날" in name


def test_공휴일_아니면_None():
    assert get_holiday_name(date(2026, 5, 13)) is None


def test_광복절_이름():
    name = get_holiday_name(date(2026, 8, 15))
    assert name is not None
    assert "광복절" in name


# ── is_holiday ───────────────────────────────────────────────


def test_is_holiday_공휴일():
    assert is_holiday(date(2026, 5, 5)) is True


def test_is_holiday_평일():
    assert is_holiday(date(2026, 5, 13)) is False


def test_is_holiday_주말():
    # 일요일은 공휴일이 아님 (단지 주말)
    assert is_holiday(date(2026, 5, 10)) is False
