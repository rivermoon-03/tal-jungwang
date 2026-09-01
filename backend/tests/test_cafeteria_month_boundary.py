"""학식 식단표 — 월 경계 주차 파싱 회귀 테스트.

2026-08-31 주차 원본(학생식당, E동레스토랑(08.31).xlsx)의 날짜 헤더는
"31일 · 9/1일 · 2일 · 3일 · 4일 · 5일(토)" 이었다. 월이 바뀌는 첫 칸만
"9/1일" 처럼 월을 앞에 달고 오는데, 이걸 못 읽으면 그 열이 통째로 빠져
개강일(9/1) 식단이 사라진다 — 실제로 프로덕션에서 그렇게 났다.
"""
from datetime import datetime

import openpyxl
import pytest

from app.services import cafeteria as caf


def _sheet_with_headers(headers: list[str]):
    wb = openpyxl.Workbook()
    ws = wb.active
    for col, text in enumerate(headers, start=1):
        ws.cell(row=1, column=col, value=text)
    return ws


def test_월을_앞에_단_날짜_헤더도_열로_잡힌다():
    ws = _sheet_with_headers(["8월", "31일", "9/1일", "2일", "3일", "4일", "5일(토)"])

    cols = caf._find_date_columns(ws, 1)

    assert [day for _, day in cols] == ["31", "1", "2", "3", "4", "5"]
    assert [col for col, _ in cols] == [2, 3, 4, 5, 6, 7]


def test_월_표기가_없는_평범한_주차도_그대로_읽는다():
    ws = _sheet_with_headers(["5월", "11일", "12일", "13일", "14일", "15일"])

    assert [day for _, day in caf._find_date_columns(ws, 1)] == ["11", "12", "13", "14", "15"]


@pytest.mark.parametrize(
    "week_start,now,expected",
    [
        ("8.31", datetime(2026, 9, 1), 2026),      # 같은 해 — 그대로
        ("12.28", datetime(2027, 1, 2), 2026),     # 연말 주차를 해 넘겨 받음
        ("1.4", datetime(2026, 12, 29), 2027),     # 새해 첫 주차를 미리 받음
        ("이상한값", datetime(2026, 9, 1), 2026),  # 파싱 실패 시 현재 연도
    ],
)
def test_주차_연도를_시트명과_현재_시각으로_보정한다(week_start, now, expected):
    assert caf._resolve_week_year(week_start, now) == expected
