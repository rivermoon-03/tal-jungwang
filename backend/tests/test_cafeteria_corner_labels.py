"""학식 식단표 — 코너 라벨("①코너" 등) 파싱 회귀 테스트.

_collect_menu가 "①코너" 셀과 그 아래 메뉴 셀을 각각 독립된 배열 원소로
내보내던 결함(#10) — 실측(2026-08-31 주차)에서 by_day가
["①코너", "떡만두국", "②코너", "김치볶음밥/고로케샐러드"] 형태로 나왔고,
프런트가 이 배열을 그대로 태그로 그리면 "①코너"가 메뉴 이름처럼 보였다.
라벨은 그 뒤에 오는 메뉴의 구분자이므로 하나의 문자열로 묶어 내보낸다.
mealMenu.js의 CORNER_PREFIX_RE는 원래 이 묶인 형태("①코너 김치볶음밥…")를
가정하고 짜여 있었다 — 파서가 그 계약을 어기고 있었을 뿐이다.
"""
import openpyxl

from app.services import cafeteria as caf


def _ws_with_column(values: list[str | None]):
    wb = openpyxl.Workbook()
    ws = wb.active
    for i, v in enumerate(values, start=1):
        ws.cell(row=i, column=1, value=v)
    return ws


def test_코너_라벨과_메뉴가_한_항목으로_묶인다():
    ws = _ws_with_column(["①코너", "떡만두국", "②코너", "김치볶음밥/고로케샐러드"])

    items = caf._collect_menu(ws, 1, 4, 1)

    assert items == ["①코너 떡만두국", "②코너 김치볶음밥/고로케샐러드"]


def test_코너_라벨이_없는_평범한_메뉴는_그대로다():
    ws = _ws_with_column(["비빔밥", "된장찌개", "김치"])

    items = caf._collect_menu(ws, 1, 3, 1)

    assert items == ["비빔밥", "된장찌개", "김치"]


def test_셀프라면코너처럼_원문자가_없는_표기는_라벨로_취급하지_않는다():
    ws = _ws_with_column(["셀프라면코너", "셀프라면/밥/김치"])

    items = caf._collect_menu(ws, 1, 2, 1)

    assert items == ["셀프라면코너", "셀프라면/밥/김치"]


def test_코너_라벨_아래에_메뉴가_두_줄이면_모두_같은_라벨을_붙인다():
    ws = _ws_with_column(["①코너", "메인메뉴", "보조메뉴"])

    items = caf._collect_menu(ws, 1, 3, 1)

    assert items == ["①코너 메인메뉴", "①코너 보조메뉴"]


def test_코너_라벨_뒤에_메뉴가_없으면_라벨을_그대로_남겨_데이터를_잃지_않는다():
    ws = _ws_with_column(["①코너"])

    items = caf._collect_menu(ws, 1, 1, 1)

    assert items == ["①코너"]
