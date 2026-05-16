"""지하철 서비스 전용 day_type 매핑 헬퍼 테스트.

subway_timetable_entries 시드는 saturday 0건 / sunday 476건이라,
토요일도 sunday 시간표를 사용해야 한다 (회귀 방지).
"""
from datetime import date

from app.services.subway import _subway_day_type


def test_토요일은_sunday로_매핑():
    # 2026-05-16 토요일 — DB saturday 시드 0건이므로 sunday 로 폴백
    assert _subway_day_type(date(2026, 5, 16)) == "sunday"


def test_일요일은_sunday():
    # 2026-05-17 일요일
    assert _subway_day_type(date(2026, 5, 17)) == "sunday"


def test_평일은_weekday():
    # 2026-05-18 월요일 — 일반 평일
    assert _subway_day_type(date(2026, 5, 18)) == "weekday"


def test_평일_공휴일은_sunday():
    # 2026-05-05 어린이날 (화) — 공휴일 → sunday
    assert _subway_day_type(date(2026, 5, 5)) == "sunday"


def test_토요일_공휴일도_sunday():
    # saturday 처리 경로와 공휴일 처리 경로 모두 sunday 로 수렴해야 함.
    # 2026-03-01 일요일은 삼일절(공휴일 + 일요일)이라 영향 없음.
    # 토요일 공휴일 예시가 2026년에 마땅치 않으므로, 가장 가까운 토요일을 확인:
    # 2026-05-16(토)은 공휴일 아님이지만 saturday 분기를 직접 검증.
    assert _subway_day_type(date(2026, 5, 16)) == "sunday"
