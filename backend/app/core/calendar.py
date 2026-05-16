"""한국 공휴일을 고려한 day_type 매핑 헬퍼.

현재 시간표 시드는 weekday/saturday/sunday 3종만 존재하므로,
한국 공휴일은 모두 'sunday' 로 매핑한다. 향후 공휴일 전용 시간표가 추가되면
별도 day_type 으로 확장할 수 있도록 헬퍼를 분리해 둔다.
"""
from __future__ import annotations

from datetime import date

import holidays

# 모듈 로드 시 단 한 번 인스턴스화 — holidays 라이브러리는 lazy 평가하므로 가볍다.
_KR_HOLIDAYS = holidays.country_holidays("KR", language="ko")


def get_holiday_name(d: date) -> str | None:
    """그 날짜가 한국 공휴일이면 이름(한글)을 반환, 아니면 None."""
    name = _KR_HOLIDAYS.get(d)
    return name if name else None


def is_holiday(d: date) -> bool:
    """주어진 날짜가 한국 공휴일인지 여부."""
    return d in _KR_HOLIDAYS


def get_day_type(d: date) -> str:
    """평일/토/일/공휴일을 weekday/saturday/sunday 3종 day_type으로 매핑.

    공휴일은 'sunday' 로 매핑 (대중교통 통상 운영 형태).
    DB에 공휴일 전용 시간표 시드가 없는 현재 정책.
    """
    if is_holiday(d):
        return "sunday"
    wd = d.weekday()
    if wd < 5:
        return "weekday"
    if wd == 5:
        return "saturday"
    return "sunday"
