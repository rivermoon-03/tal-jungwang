"""app.services.school 단위 테스트 — DB/캐시 레이어. 외부 사이트는 절대 호출하지
않는다(스크레이퍼 함수는 patch로 대체)."""
from __future__ import annotations

from datetime import date, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import fakeredis
import pytest

from app.core import cache as cache_mod
from app.services import school

_KST = ZoneInfo("Asia/Seoul")


@pytest.fixture
def fake_redis():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


def _db_with_scalars(rows):
    db = MagicMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = rows
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    return db


# ── departments ──────────────────────────────────────────────────────────


def test_list_departments_marks_ce_supported_and_others_unsupported():
    depts = school.list_departments()
    by_code = {d["code"]: d for d in depts}

    assert by_code["ce"]["supported"] is True
    assert "unsupported_reason" not in by_code["ce"]

    others = [d for code, d in by_code.items() if code != "ce"]
    assert len(others) > 0
    for d in others:
        assert d["supported"] is False
        assert isinstance(d["unsupported_reason"], str) and d["unsupported_reason"]


def test_is_valid_department():
    assert school.is_valid_department("ce") is True
    assert school.is_valid_department("ee") is False
    assert school.is_valid_department("") is False


# ── get_notices (cache-aside) ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_notices_queries_db_on_cache_miss_and_shapes_output(fake_redis):
    notice = MagicMock(
        external_id=151703,
        title="공지 제목",
        url="https://www.tukorea.ac.kr/bbs/ce/201/151703/artclView.do",
        published_at=datetime(2026, 7, 16, 21, 27, 37, tzinfo=_KST),
    )
    db = _db_with_scalars([notice])

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        result = await school.get_notices(db, "ce")

    assert result == [
        {
            "id": 151703,
            "title": "공지 제목",
            "url": "https://www.tukorea.ac.kr/bbs/ce/201/151703/artclView.do",
            "published_at": "2026-07-16T21:27:37+09:00",
        }
    ]
    db.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_notices_cache_hit_skips_db(fake_redis):
    await fake_redis.set("school:notices:ce", '[{"id": 1, "title": "cached", "url": "u", "published_at": "x"}]')
    db = _db_with_scalars([])

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)):
        result = await school.get_notices(db, "ce")

    assert result[0]["title"] == "cached"
    db.execute.assert_not_awaited()


# ── get_calendar ─────────────────────────────────────────────────────────


def _cal_event(title, start, end=None):
    ev = MagicMock()
    ev.title = title
    ev.start_date = start
    ev.end_date = end
    return ev


@pytest.mark.asyncio
async def test_get_calendar_next_and_upcoming(fake_redis):
    rows = [
        _cal_event("지난 일정", date(2026, 1, 1), date(2026, 1, 2)),
        _cal_event("기말고사", date(2026, 6, 9), date(2026, 6, 22)),
        _cal_event("하계방학 시작", date(2026, 6, 23)),
        _cal_event("2학기 개강", date(2026, 9, 1)),
    ]
    db = _db_with_scalars(rows)

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(school, "datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 6, 15, tzinfo=_KST)
        result = await school.get_calendar(db)

    assert result["next"] == {
        "title": "기말고사",
        "start_date": "2026-06-09",
        "end_date": "2026-06-22",
    }
    assert result["upcoming"] == [
        {"title": "하계방학 시작", "start_date": "2026-06-23", "end_date": "2026-06-23"},
        {"title": "2학기 개강", "start_date": "2026-09-01", "end_date": "2026-09-01"},
    ]


@pytest.mark.asyncio
async def test_get_calendar_ongoing_event_counts_as_next(fake_redis):
    """오늘이 진행 중인 이벤트 기간 내에 있으면(start<=today<=end) 그 이벤트가 next."""
    rows = [_cal_event("기말고사", date(2026, 6, 9), date(2026, 6, 22))]
    db = _db_with_scalars(rows)

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(school, "datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 6, 20, tzinfo=_KST)
        result = await school.get_calendar(db)

    assert result["next"]["title"] == "기말고사"


@pytest.mark.asyncio
async def test_get_calendar_empty_when_no_future_events(fake_redis):
    rows = [_cal_event("지난 일정", date(2020, 1, 1))]
    db = _db_with_scalars(rows)

    with patch.object(cache_mod, "get_redis", AsyncMock(return_value=fake_redis)), \
         patch.object(school, "datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 6, 20, tzinfo=_KST)
        result = await school.get_calendar(db)

    assert result == {"next": None, "upcoming": []}


# ── refresh_department_notices ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_refresh_department_notices_inserts_with_on_conflict_do_nothing():
    fetched = [
        {
            "external_id": 1,
            "title": "새 공지",
            "url": "https://www.tukorea.ac.kr/bbs/ce/201/1/artclView.do",
            "published_at": datetime(2026, 7, 16, tzinfo=_KST),
        }
    ]
    db = MagicMock()
    exec_result = MagicMock(rowcount=1)
    db.execute = AsyncMock(return_value=exec_result)
    db.commit = AsyncMock()

    with patch(
        "app.services.external.tukorea_notices.fetch_department_notices",
        new=AsyncMock(return_value=fetched),
    ), patch.object(school, "delete_keys", new=AsyncMock(return_value=1)) as mock_del:
        summary = await school.refresh_department_notices(db, "ce")

    assert summary == {"department": "ce", "fetched": 1, "inserted": 1}
    db.commit.assert_awaited_once()
    mock_del.assert_awaited_once_with("school:notices:ce")


@pytest.mark.asyncio
async def test_refresh_department_notices_empty_response_is_graceful():
    db = MagicMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()

    with patch(
        "app.services.external.tukorea_notices.fetch_department_notices",
        new=AsyncMock(return_value=[]),
    ):
        summary = await school.refresh_department_notices(db, "ce")

    assert summary == {"department": "ce", "fetched": 0, "inserted": 0}
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_refresh_department_notices_propagates_fetch_failure():
    """스크레이핑 실패 시 예외를 삼키지 않고 그대로 전파한다 — 호출부(scheduler job)가
    잡아서 이전 DB 데이터를 유지(graceful degradation)한다."""
    db = MagicMock()

    with patch(
        "app.services.external.tukorea_notices.fetch_department_notices",
        new=AsyncMock(side_effect=RuntimeError("network down")),
    ):
        with pytest.raises(RuntimeError):
            await school.refresh_department_notices(db, "ce")


# ── refresh_academic_calendar ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_refresh_academic_calendar_inserts_with_on_conflict_do_nothing():
    fetched = [{"title": "새 일정", "start_date": date(2026, 9, 1), "end_date": date(2026, 9, 1)}]
    db = MagicMock()
    exec_result = MagicMock(rowcount=1)
    db.execute = AsyncMock(return_value=exec_result)
    db.commit = AsyncMock()

    with patch(
        "app.services.external.tukorea_calendar.fetch_academic_calendar",
        new=AsyncMock(return_value=fetched),
    ), patch.object(school, "delete_keys", new=AsyncMock(return_value=1)) as mock_del:
        summary = await school.refresh_academic_calendar(db)

    assert summary == {"fetched": 1, "inserted": 1}
    db.commit.assert_awaited_once()
    mock_del.assert_awaited_once_with("school:calendar")
