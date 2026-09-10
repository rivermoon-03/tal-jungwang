"""bus_history_preview 응답의 realtime_eta / predicted_eta 단위 테스트.

스펙: docs/superpowers/specs/2026-05-16-bus-history-sheet-eta-card-design.md

`_compute_realtime_eta` / `_compute_predicted_eta` 두 헬퍼를 직접 호출해
시나리오를 검증한다.

predicted_eta는 raw bus_arrival_history 대신, 이미 dedupe된 `columns` 데이터로부터
"현재 시각 이후 첫 도착"의 중앙값을 산출. display↔prediction 일치 보장.
"""
from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

import pytest

from app.api import bus as bus_api


KST = ZoneInfo("Asia/Seoul")


def _col(times):
    """테스트용 컬럼 dict (label/date는 predicted 계산에서 무시되므로 생략)."""
    return {"times": list(times)}


# ───────────────────────── realtime_eta ─────────────────────────

@pytest.mark.asyncio
async def test_realtime_eta_with_two_arrivals():
    """get_arrivals가 2건 반환하면 primary/secondary 모두 채워진다."""
    now_kst = datetime(2026, 5, 16, 21, 0, 0, tzinfo=KST)
    fake_arrivals = {
        "station_id": 1,
        "station_name": "한국공학대학교",
        "arrivals": [
            {"route_id": 99, "arrive_in_seconds": 60},        # 다른 route — 필터됨
            {"route_id": 3, "arrive_in_seconds": 195},
            {"route_id": 3, "arrive_in_seconds": 840},
            {"route_id": 3, "arrive_in_seconds": -10},        # 음수 — 제외
            {"route_id": 3, "arrive_in_seconds": None},       # None — 제외
        ],
    }

    with patch.object(bus_api, "get_arrivals", new=AsyncMock(return_value=fake_arrivals)):
        result = await bus_api._compute_realtime_eta(
            db=None, route_ids=[3], stop_id=1, now_kst=now_kst
        )

    assert result is not None
    assert result["primary"]["arrive_in_seconds"] == 195
    assert result["primary"]["arrive_at_hhmm"] == "21:03"
    assert result["secondary"]["arrive_in_seconds"] == 840
    assert result["secondary"]["arrive_at_hhmm"] == "21:14"


@pytest.mark.asyncio
async def test_realtime_eta_returns_none_when_empty():
    """get_arrivals가 빈 arrivals 반환 → None."""
    fake_arrivals = {"station_id": 1, "station_name": "X", "arrivals": []}
    now_kst = datetime(2026, 5, 16, 21, 0, 0, tzinfo=KST)
    with patch.object(bus_api, "get_arrivals", new=AsyncMock(return_value=fake_arrivals)):
        result = await bus_api._compute_realtime_eta(
            db=None, route_ids=[3], stop_id=1, now_kst=now_kst
        )
    assert result is None


@pytest.mark.asyncio
async def test_realtime_eta_returns_none_when_route_unmatched():
    """get_arrivals에 결과는 있으나 route_id 매칭이 없으면 None."""
    fake_arrivals = {
        "station_id": 1,
        "station_name": "X",
        "arrivals": [
            {"route_id": 99, "arrive_in_seconds": 100},
            {"route_id": 42, "arrive_in_seconds": 200},
        ],
    }
    now_kst = datetime(2026, 5, 16, 21, 0, 0, tzinfo=KST)
    with patch.object(bus_api, "get_arrivals", new=AsyncMock(return_value=fake_arrivals)):
        result = await bus_api._compute_realtime_eta(
            db=None, route_ids=[3], stop_id=1, now_kst=now_kst
        )
    assert result is None


@pytest.mark.asyncio
async def test_realtime_eta_single_arrival_secondary_none():
    """get_arrivals가 1건만 매칭되면 secondary=None."""
    fake_arrivals = {
        "station_id": 1,
        "station_name": "X",
        "arrivals": [{"route_id": 3, "arrive_in_seconds": 240}],
    }
    now_kst = datetime(2026, 5, 16, 21, 0, 0, tzinfo=KST)
    with patch.object(bus_api, "get_arrivals", new=AsyncMock(return_value=fake_arrivals)):
        result = await bus_api._compute_realtime_eta(
            db=None, route_ids=[3], stop_id=1, now_kst=now_kst
        )
    assert result is not None
    assert result["primary"]["arrive_in_seconds"] == 240
    assert result["secondary"] is None


@pytest.mark.asyncio
async def test_realtime_eta_returns_none_when_stop_id_missing():
    """stop_id=None이면 호출 자체를 건너뛰고 None."""
    now_kst = datetime(2026, 5, 16, 21, 0, 0, tzinfo=KST)
    result = await bus_api._compute_realtime_eta(
        db=None, route_ids=[3], stop_id=None, now_kst=now_kst
    )
    assert result is None


# ───────────────────────── predicted_eta ─────────────────────────

def test_predicted_eta_median_with_four_columns_saturday():
    """5200 시나리오: 3건 21:35~21:38 + 1건 22:03. median = 21:38."""
    # 화면 표시 데이터를 그대로 simulate
    columns = [
        _col(["20:33", "21:03", "21:33", "22:03", "22:39", "22:44"]),  # 저번 주 토 5/9
        _col(["20:03", "20:35", "21:03", "21:08", "21:35", "22:04"]),  # 저번 주 일 5/10
        _col(["20:33", "21:07", "21:11", "21:33", "21:38", "22:04"]),  # 저저번 주 토 5/2
        _col(["20:03", "20:33", "21:03", "21:34", "21:38", "22:04"]),  # 저저번 주 일 5/3
    ]
    now_kst = datetime(2026, 5, 16, 21, 34, 0, tzinfo=KST)  # 토요일 21:34

    result = bus_api._compute_predicted_eta(columns, now_kst)

    assert result is not None
    # first > 21:34 per column: 22:03, 21:35, 21:38, 21:38
    # sorted: [21:35, 21:38, 21:38, 22:03]
    # median = (21:38 + 21:38)//2 = 21:38
    assert result["hhmm"] == "21:38"
    assert result["sample_size"] == 4
    assert result["day_label"] == "주말"


def test_predicted_eta_three_columns_weekday():
    """평일 3컬럼: median 산출 + day_label='평일'."""
    columns = [
        _col(["08:00", "08:30", "09:00"]),
        _col(["08:05", "08:35", "09:05"]),
        _col(["08:10", "08:40", "09:10"]),
    ]
    now_kst = datetime(2026, 5, 15, 8, 20, 0, tzinfo=KST)  # 금요일

    result = bus_api._compute_predicted_eta(columns, now_kst)
    assert result is not None
    # firsts > 08:20: 08:30, 08:35, 08:40 → median = 08:35
    assert result["hhmm"] == "08:35"
    assert result["sample_size"] == 3
    assert result["day_label"] == "평일"


def test_predicted_eta_returns_none_when_less_than_two_matches():
    """현재 시각 이후 도착이 1건 이하만 있으면 None."""
    columns = [
        _col(["20:00", "20:30"]),  # 모두 과거
        _col(["20:10", "20:40"]),  # 모두 과거
        _col(["21:30"]),           # 1건 미래
    ]
    now_kst = datetime(2026, 5, 16, 21, 0, 0, tzinfo=KST)

    result = bus_api._compute_predicted_eta(columns, now_kst)
    assert result is None


def test_predicted_eta_returns_none_when_columns_empty():
    """빈 컬럼이면 None."""
    now_kst = datetime(2026, 5, 16, 21, 0, 0, tzinfo=KST)
    assert bus_api._compute_predicted_eta([], now_kst) is None
    assert bus_api._compute_predicted_eta(
        [_col([]), _col([])], now_kst
    ) is None


def test_predicted_eta_sunday_is_weekend():
    """일요일도 day_label='주말'."""
    columns = [_col(["21:30"]), _col(["21:40"])]
    now_kst = datetime(2026, 5, 17, 21, 0, 0, tzinfo=KST)  # 일요일
    result = bus_api._compute_predicted_eta(columns, now_kst)
    assert result is not None
    assert result["day_label"] == "주말"


def test_predicted_eta_picks_first_after_now_per_column():
    """각 컬럼에서 첫 번째 'now 이후' 시각만 선택하고 나머지는 무시."""
    columns = [
        _col(["20:00", "21:10", "21:30", "21:50"]),  # 첫 future: 21:10
        _col(["20:00", "21:15", "21:40"]),           # 첫 future: 21:15
    ]
    now_kst = datetime(2026, 5, 16, 21, 0, 0, tzinfo=KST)

    result = bus_api._compute_predicted_eta(columns, now_kst)
    assert result is not None
    # firsts: [21:10, 21:15] → median = (21:10 + 21:15)//2 = 21:12
    assert result["hhmm"] == "21:12"
    assert result["sample_size"] == 2


def test_history_rows_statement_scopes_history_to_requested_source_stop():
    stmt = bus_api._build_history_rows_statement(
        route_ids=[15],
        target_dates=[datetime(2026, 7, 25).date()],
        requested_stop_id=2,
    )

    assert "bus_arrival_history.stop_id =" in str(stmt)


# ── 관측 공백이 있는 날은 예측에 표를 주지 않는다 ──────────────────────────


def test_predicted_eta_skips_day_without_coverage_before_now():
    """그날 지금보다 앞선 기록이 없으면 그 컬럼은 세지 않는다.

    2026-09-10 실측 재현. 5200 이 09:00 에 "보통 11:11 쯤 도착" 이라고 말했다.
    9/3 은 하루 종일 관측돼 09:00 이후 첫차가 09:10 이었고, 8/27 은 하루 통틀어
    13:12 한 건뿐이었다. 그 13:12 를 "그날의 다음 차" 로 세는 바람에 중앙값이
    어떤 버스도 오지 않는 11:11 이 됐다.
    """
    columns = [
        _col(["07:25", "07:43", "08:11", "08:44", "09:10", "09:33", "10:04"]),
        _col(["13:12"]),
    ]
    now_kst = datetime(2026, 9, 10, 9, 0, 0, tzinfo=KST)

    result = bus_api._compute_predicted_eta(columns, now_kst)

    # 표를 준 컬럼이 하나뿐이라 2건 미만 → 예측 자체를 내지 않는다.
    assert result is None


def test_predicted_eta_counts_day_with_coverage():
    """지금보다 앞선 기록이 있는 날은 정상적으로 표를 준다."""
    columns = [
        _col(["08:00", "08:30", "09:10"]),
        _col(["08:05", "08:35", "09:20"]),
    ]
    now_kst = datetime(2026, 9, 10, 9, 0, 0, tzinfo=KST)

    result = bus_api._compute_predicted_eta(columns, now_kst)
    assert result is not None
    assert result["hhmm"] == "09:15"
    assert result["sample_size"] == 2


def test_predicted_eta_rejects_far_future_median():
    """중앙값이 지금으로부터 너무 멀면 내놓지 않는다.

    표본이 나빠 결과가 몇 시간 뒤로 나와도 화면은 "보통 …쯤 도착" 이라고
    단정한다. 그런 값은 아예 만들지 않는다.
    """
    columns = [
        _col(["07:00", "14:30"]),
        _col(["07:10", "15:00"]),
    ]
    now_kst = datetime(2026, 9, 10, 9, 0, 0, tzinfo=KST)

    assert bus_api._compute_predicted_eta(columns, now_kst) is None
