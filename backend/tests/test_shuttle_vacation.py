"""여름방학 셔틀(D1) — variant 전달 + 기간 목록 서비스 테스트.

2026-08 방학 시간표 반영에서 추가된 두 가지를 고정한다:
  1. get_schedule 응답의 times 항목에 variant(seasonal|reduced|normal|None)가 실린다
     — 프런트 색상 분류(계절학기/단축근무/정상근무)의 데이터 계약.
  2. get_periods 가 오늘 전후 기간을 시작일 순으로 반환한다 — 기간 전환 칩의 원천.
"""
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services import shuttle as shuttle_service

# 2026-08-03 월요일 — 여름방학 · 단축근무(P3) 기간의 평일.
VACATION_WEEKDAY = date(2026, 8, 3)


def _entries(rows):
    """(direction, "HH:MM:SS", note, variant) → _load_entries 형식."""
    return [
        {"direction": d, "departure_time": dep, "note": note, "variant": variant}
        for d, dep, note, variant in rows
    ]


@pytest.mark.asyncio
async def test_스케줄_응답_times에_variant가_실린다():
    period = {
        "id": 42,
        "period_type": "VACATION",
        "name": "여름방학 · 단축근무",
        "start_date": "2026-07-14",
        "end_date": "2026-08-24",
    }
    entries = _entries([
        (1, "09:10:00", None, None),            # 공통
        (1, "15:35:00", None, "reduced"),       # 단축근무 증편
        (0, "13:10:00", None, "seasonal"),      # (예시) 계절학기 태그
    ])

    async def fake_period(_db, _d):
        return period

    async def fake_entries(_db, _pid, _day):
        return entries

    with patch.object(shuttle_service, "_load_period", side_effect=fake_period), \
         patch.object(shuttle_service, "_load_entries", side_effect=fake_entries):
        result = await shuttle_service.get_schedule(db=None, d=VACATION_WEEKDAY)

    assert result is not None
    by_dir = {d["direction"]: d["times"] for d in result["directions"]}
    assert by_dir[1][0]["variant"] is None
    assert by_dir[1][1]["variant"] == "reduced"
    assert by_dir[0][0]["variant"] == "seasonal"
    assert result["schedule_name"] == "여름방학 · 단축근무"


@pytest.mark.asyncio
async def test_기간_목록은_시작일_순으로_반환된다():
    rows = [
        SimpleNamespace(
            id=1, period_type="SEASONAL", name="여름방학 · 계절학기(단축근무)",
            start_date=date(2026, 7, 1), end_date=date(2026, 7, 13),
            priority=110, notice_message=None,
        ),
        SimpleNamespace(
            id=2, period_type="VACATION", name="여름방학 · 단축근무",
            start_date=date(2026, 7, 14), end_date=date(2026, 8, 24),
            priority=110, notice_message="정왕역~본교 소요 약 10분",
        ),
    ]

    fake_result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: rows))
    fake_db = SimpleNamespace(execute=AsyncMock(return_value=fake_result))

    with patch.object(shuttle_service, "get_cached_json", AsyncMock(return_value=None)), \
         patch.object(shuttle_service, "set_cached_json", AsyncMock()) as set_mock:
        data = await shuttle_service.get_periods(fake_db, VACATION_WEEKDAY)

    names = [p["name"] for p in data["periods"]]
    assert names == ["여름방학 · 계절학기(단축근무)", "여름방학 · 단축근무"]
    assert data["periods"][1]["start_date"] == "2026-07-14"
    assert data["periods"][1]["end_date"] == "2026-08-24"
    # 비어있지 않은 목록은 정규 TTL로 캐시된다
    assert set_mock.await_args.kwargs.get("ttl") == shuttle_service._PERIOD_TTL


@pytest.mark.asyncio
async def test_기간_목록_캐시가_있으면_DB를_치지_않는다():
    cached = {"periods": []}
    fake_db = SimpleNamespace(execute=AsyncMock())

    with patch.object(shuttle_service, "get_cached_json", AsyncMock(return_value=cached)):
        data = await shuttle_service.get_periods(fake_db, VACATION_WEEKDAY)

    assert data == cached
    fake_db.execute.assert_not_awaited()


def test_방학_마이그레이션_SQL_핵심_불변식():
    """prod_migration_20260802 — 손으로 쓴 시드의 오탈자 안전망.

    전체를 재검증하진 않고(그건 PDF와의 대조 몫), 기간 4개의 이름/날짜와
    단축근무 증편의 대표 시각, variant CHECK 존재만 고정한다.
    """
    from pathlib import Path

    sql = Path(__file__).resolve().parents[2].joinpath(
        "scripts", "prod_migration_20260802_summer_vacation_shuttle.sql"
    ).read_text(encoding="utf-8")

    for name in [
        "여름방학 · 계절학기(정상근무)",
        "여름방학 · 계절학기(단축근무)",
        "여름방학 · 단축근무",
        "여름방학 · 정상근무",
    ]:
        assert name in sql

    for token in [
        "DATE '2026-06-24', DATE '2026-06-30'",
        "DATE '2026-07-01', DATE '2026-07-13'",
        "DATE '2026-07-14', DATE '2026-08-24'",
        "DATE '2026-08-25', DATE '2026-08-31'",
        "TIME '15:35'",   # 단축근무 하교 증편 대표값
        "회차편 · 학교 19:45 출발 (막차)",
        "CHECK (variant IN ('seasonal', 'reduced', 'normal'))",
    ]:
        assert token in sql, f"누락: {token}"


@pytest.mark.asyncio
async def test_캐시_무효화가_기간_목록_키까지_지운다():
    """'shuttle:period:*' 패턴은 복수형 키(shuttle:periods:<date>)를 못 잡는다.

    마이그레이션으로 새 학기 기간을 넣고 재배포해도 기간 전환 칩이 옛 목록을
    최대 1시간 들고 있던 원인 - 무효화 패턴에 복수형을 따로 넣어야 한다.
    """
    with patch.object(shuttle_service, "delete_keys", new=AsyncMock(return_value=1)) as mock:
        cleared = await shuttle_service.invalidate_shuttle_cache()

    patterns = [c.args[0] for c in mock.call_args_list]
    assert "shuttle:periods:*" in patterns
    assert {"shuttle:period:*", "shuttle:entries:*"} <= set(patterns)
    assert cleared == len(patterns)
