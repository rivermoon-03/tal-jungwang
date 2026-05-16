"""지하철 ``get_next`` 자정 보정 + KST 통일 회귀 테스트.

이전 버그: ``now=23:30`` 사용자가 다음 열차를 조회하면 새벽 출발 열차
(00:01:30 등) 가 문자열 사전순 비교(``"00:01:30" <= "23:30:00"``)에서
이미 지나간 것으로 판정되어 buckets 에서 빠졌다. 결과적으로 자정 직전
사용자에게 "다음 열차 없음" 표시.

또한 ``datetime.combine(..., tzinfo=timezone.utc)`` 로 KST 데이터에 UTC
시간대를 부여하던 문제도 KST 통일로 해결.
"""
from datetime import date, time
from unittest.mock import patch

import pytest

from app.services import subway as subway_service


def _entries(rows):
    """(direction, "HH:MM:SS", destination) 튜플 list 를 _load_entries 형식으로 변환."""
    return [
        {
            "direction": d,
            "departure_time": dep,
            "destination": dest,
            "updated_at": None,
        }
        for d, dep, dest in rows
    ]


async def _run_get_next(entries, d: date, now_time: time):
    """``_load_entries`` 를 패치해 in-memory entries 로 ``get_next`` 호출."""
    async def fake_load(_db, _day):
        return entries

    with patch.object(subway_service, "_load_entries", side_effect=fake_load):
        return await subway_service.get_next(db=None, d=d, now_time=now_time)


# 2026-05-18 월요일(평일) — calendar 영향 받지 않는 무난한 평일.
TODAY = date(2026, 5, 18)


# ── 1. 자정 막차 버그 회귀 ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_23시반_사용자에게_자정_후_열차가_보인다():
    """now=23:30 + 시간표 [23:55, 00:01:30, 00:05]:
    - 다음 = 23:55 (25분 후)
    - 그 다음 = 00:01:30 (31분 30초 후 — 자정 보정으로 다음날)
    이전 버그에서는 ``"00:01:30" <= "23:30:00"`` 문자열 비교로 인해 둘 다 누락.
    """
    entries = _entries([
        ("up", "23:55:00", "왕십리"),
        ("up", "00:01:30", "왕십리"),
        ("up", "00:05:00", "왕십리"),
    ])
    result = await _run_get_next(entries, TODAY, time(23, 30))

    assert result["up"] is not None
    assert result["up"]["depart_at"] == "23:55"
    assert result["up"]["arrive_in_seconds"] == 25 * 60

    assert result["up"]["next_depart_at"] == "00:01"
    # 23:30:00 → 익일 00:01:30 = 31분 30초 = 1890초
    assert result["up"]["next_arrive_in_seconds"] == 31 * 60 + 30


# ── 2. 낮 시간엔 자정 보정 안 함 ───────────────────────────────────────


@pytest.mark.asyncio
async def test_낮_12시_사용자에게는_자정_열차가_보이지_않는다():
    """now=12:00 시점에서 00:05 출발은 "이미 지나간 새벽 열차"로 판단해야 한다.
    (현재 시각이 늦은 밤이 아니므로 자정 보정 트리거 안 됨.)
    """
    entries = _entries([
        ("up", "00:05:00", "왕십리"),
        ("up", "13:00:00", "왕십리"),
        ("up", "14:00:00", "왕십리"),
    ])
    result = await _run_get_next(entries, TODAY, time(12, 0))

    assert result["up"] is not None
    assert result["up"]["depart_at"] == "13:00"
    assert result["up"]["arrive_in_seconds"] == 60 * 60
    assert result["up"]["next_depart_at"] == "14:00"


# ── 3. 자정 직후 0:30 케이스 ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_자정_직후_사용자():
    """now=00:30 + [00:50, 01:00]: 자정 보정 불필요한 일반 케이스."""
    entries = _entries([
        ("up", "00:50:00", "왕십리"),
        ("up", "01:00:00", "왕십리"),
    ])
    result = await _run_get_next(entries, TODAY, time(0, 30))

    assert result["up"] is not None
    assert result["up"]["depart_at"] == "00:50"
    assert result["up"]["arrive_in_seconds"] == 20 * 60
    assert result["up"]["next_depart_at"] == "01:00"
    assert result["up"]["next_arrive_in_seconds"] == 30 * 60


# ── 4. 정말로 막차 지난 케이스 ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_막차_이후엔_None():
    """now=23:50 인데 시간표 마지막이 23:45 면 다음 열차 없음."""
    entries = _entries([
        ("up", "23:45:00", "왕십리"),
    ])
    result = await _run_get_next(entries, TODAY, time(23, 50))
    assert result["up"] is None


# ── 5. 방향이 여러 개 섞여 있어도 각 방향별로 첫 2건 정확 ───────────────


@pytest.mark.asyncio
async def test_방향_여러개_각각_상위_2건():
    """up, down, line4_up 가 섞여 있을 때 각자의 다음/다다음 열차가 정확히 매핑되는지."""
    entries = _entries([
        ("up", "10:00:00", "왕십리"),
        ("down", "10:05:00", "인천"),
        ("up", "10:10:00", "왕십리"),
        ("line4_up", "10:15:00", "당고개"),
        ("down", "10:20:00", "인천"),
        ("up", "10:30:00", "왕십리"),         # 3번째 — 무시되어야 함
        ("line4_up", "10:25:00", "당고개"),
    ])
    result = await _run_get_next(entries, TODAY, time(9, 50))

    assert result["up"]["depart_at"] == "10:00"
    assert result["up"]["next_depart_at"] == "10:10"

    assert result["down"]["depart_at"] == "10:05"
    assert result["down"]["next_depart_at"] == "10:20"

    assert result["line4_up"]["depart_at"] == "10:15"
    assert result["line4_up"]["next_depart_at"] == "10:25"

    # 다른 방향은 entries 없으므로 None
    assert result["line4_down"] is None
    assert result["choji_up"] is None


# ── 6. 자정 보정 후에도 정렬이 정확한지 (entries 순서가 깨지는 케이스) ────


@pytest.mark.asyncio
async def test_자정_보정_후_정렬_정확():
    """entries 가 DB 순서로 [23:00, 23:30, 00:01, 00:10] 일 때:
    now=22:50 → 다음 = 23:00 (10분 후), next = 23:30.
    now=23:50 → 다음 = 00:01 (11분 후, 익일), next = 00:10 (20분 후).
    """
    entries = _entries([
        ("up", "23:00:00", "왕십리"),
        ("up", "23:30:00", "왕십리"),
        ("up", "00:01:00", "왕십리"),
        ("up", "00:10:00", "왕십리"),
    ])

    r1 = await _run_get_next(entries, TODAY, time(22, 50))
    assert r1["up"]["depart_at"] == "23:00"
    assert r1["up"]["next_depart_at"] == "23:30"

    r2 = await _run_get_next(entries, TODAY, time(23, 50))
    assert r2["up"]["depart_at"] == "00:01"
    assert r2["up"]["arrive_in_seconds"] == 11 * 60
    assert r2["up"]["next_depart_at"] == "00:10"
    assert r2["up"]["next_arrive_in_seconds"] == 20 * 60
