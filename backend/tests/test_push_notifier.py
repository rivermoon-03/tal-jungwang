"""push_notifier의 순수 함수(favCode 파싱, 시각 계산, payload 조립) 단위 테스트.

실제 pywebpush 전송/DB 조회는 mock으로 대체하거나(오케스트레이션 테스트) 아예 다루지
않는다(순수 함수만). run_push_notification_cycle의 통합 흐름(구독 순회 → 발송 →
last_notified 갱신 → 만료 구독 삭제)은 mock db + mock send_web_push로 검증한다.
"""
from __future__ import annotations

from datetime import date, time
from datetime import datetime as _real_datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import push_notifier as pn
from app.services.push_notifier import ParsedFavCode


# ── favCode 파싱 ──────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "fav_code, expected",
    [
        ("등교:5602", ParsedFavCode(kind="bus", route_number="5602", category="등교")),
        ("하교:3401", ParsedFavCode(kind="bus", route_number="3401", category="하교")),
        ("5602", ParsedFavCode(kind="bus", route_number="5602", category=None)),
        ("shuttle:등교", ParsedFavCode(kind="shuttle", direction=0)),
        ("shuttle:하교", ParsedFavCode(kind="shuttle", direction=1)),
        ("shuttle:2캠 등교", ParsedFavCode(kind="shuttle", direction=2)),
        ("shuttle:2캠 하교", ParsedFavCode(kind="shuttle", direction=3)),
        (
            "subway:정왕:up",
            ParsedFavCode(kind="subway", station_group="정왕", subway_key="up"),
        ),
        (
            "subway:초지:choji_up",
            ParsedFavCode(kind="subway", station_group="초지", subway_key="choji_up"),
        ),
    ],
)
def test_parse_fav_code_valid(fav_code, expected):
    assert pn.parse_fav_code(fav_code) == expected


@pytest.mark.parametrize(
    "fav_code",
    [
        "",
        "shuttle:없는방향",
        "shuttle:",
        "subway:정왕",  # key 누락
        "subway:정왕:unknown_key",
        "subway::up",  # station_group 빈 문자열
        "등교:",  # route_number 빈 문자열
    ],
)
def test_parse_fav_code_invalid_returns_none(fav_code):
    assert pn.parse_fav_code(fav_code) is None


# ── 시각 계산 (tz-aware, wraparound 없음) ─────────────────────────────────


def test_seconds_until_basic():
    d = date(2026, 7, 18)
    assert pn.seconds_until(d, time(21, 10), time(21, 40)) == 30 * 60


def test_seconds_until_past_is_negative():
    d = date(2026, 7, 18)
    assert pn.seconds_until(d, time(21, 50), time(21, 40)) == -10 * 60


@pytest.mark.parametrize(
    "remaining, expected",
    [
        (-1, False),
        (0, False),  # 이미 출발 시각 — 알림 대상 아님
        (1, True),
        (1800, True),  # 정확히 30분 전 — 경계 포함
        (1801, False),
        (3600, False),
    ],
)
def test_is_within_notify_window(remaining, expected):
    assert pn.is_within_notify_window(remaining) == expected


# ── payload 조립 ──────────────────────────────────────────────────────────


def test_build_notification_payload_bus_last():
    payload = pn.build_notification_payload("bus", "5602번", "last", "21:40")
    assert payload["title"] == "탈것:정왕"
    assert payload["body"] == "🚌 5602번 막차가 30분 후 출발해요 (21:40)"
    assert payload["url"] == "/schedule"


def test_build_notification_payload_subway_first():
    payload = pn.build_notification_payload("subway", "정왕역 오이도행", "first", "05:32")
    assert payload["body"] == "🚇 정왕역 오이도행 첫차가 30분 후 출발해요 (05:32)"


# ── 도메인별 edge 계산 (기존 서비스 함수 재사용, mock) ─────────────────────


@pytest.mark.asyncio
async def test_resolve_bus_edges_uses_first_and_last_of_times():
    parsed = ParsedFavCode(kind="bus", route_number="5602", category="등교")
    with patch.object(
        pn.bus_service,
        "get_timetable_by_route_number",
        new=AsyncMock(return_value={"times": ["05:32", "12:00", "21:40"]}),
    ) as gt:
        result = await pn._resolve_bus_edges(db=None, parsed=parsed, d=date(2026, 7, 18))

    gt.assert_awaited_once_with(None, "5602", date(2026, 7, 18), category="등교")
    assert result["first"] == time(5, 32)
    assert result["last"] == time(21, 40)
    assert result["label"] == "5602번"
    assert result["kind"] == "bus"


@pytest.mark.asyncio
async def test_resolve_bus_edges_no_times_returns_none():
    parsed = ParsedFavCode(kind="bus", route_number="9999")
    with patch.object(
        pn.bus_service,
        "get_timetable_by_route_number",
        new=AsyncMock(return_value={"times": []}),
    ):
        result = await pn._resolve_bus_edges(db=None, parsed=parsed, d=date(2026, 7, 18))
    assert result is None


@pytest.mark.asyncio
async def test_resolve_shuttle_edges():
    parsed = ParsedFavCode(kind="shuttle", direction=0)
    schedule = {
        "directions": [
            {
                "direction": 0,
                "times": [{"depart_at": "07:00", "note": None}, {"depart_at": "21:00", "note": None}],
            }
        ]
    }
    with patch.object(pn.shuttle_service, "get_schedule", new=AsyncMock(return_value=schedule)):
        result = await pn._resolve_shuttle_edges(db=None, parsed=parsed, d=date(2026, 7, 18))

    assert result["first"] == time(7, 0)
    assert result["last"] == time(21, 0)
    assert result["label"] == "본캠 셔틀버스 등교"


@pytest.mark.asyncio
async def test_resolve_subway_edges_uses_destination():
    parsed = ParsedFavCode(kind="subway", station_group="정왕", subway_key="up")
    data = {
        "up": [
            {"depart_at": "05:10", "destination": "오이도"},
            {"depart_at": "23:40", "destination": "오이도"},
        ]
    }
    with patch.object(pn.subway_service, "get_timetable", new=AsyncMock(return_value=data)):
        result = await pn._resolve_subway_edges(db=None, parsed=parsed, d=date(2026, 7, 18))

    assert result["first"] == time(5, 10)
    assert result["last"] == time(23, 40)
    assert result["label"] == "정왕역 오이도행"
    assert result["kind"] == "subway"


@pytest.mark.asyncio
async def test_resolve_edge_times_unknown_fav_code_returns_none():
    result = await pn.resolve_edge_times(db=None, fav_code="이상한값", d=date(2026, 7, 18))
    assert result is None


@pytest.mark.asyncio
async def test_resolve_edge_times_swallows_service_exception():
    with patch.object(
        pn.bus_service,
        "get_timetable_by_route_number",
        new=AsyncMock(side_effect=RuntimeError("DB down")),
    ):
        result = await pn.resolve_edge_times(db=None, fav_code="등교:5602", d=date(2026, 7, 18))
    assert result is None


@pytest.mark.asyncio
async def test_build_targets_computes_each_unique_code_once():
    """여러 구독이 같은 favCode를 공유해도 시간표 조회는 unique 집합 크기만큼만."""
    calls: list[str] = []

    async def fake_resolve(db, fav_code, d):
        calls.append(fav_code)
        return {"first": time(5, 0), "last": time(23, 0), "label": fav_code, "kind": "bus"}

    with patch.object(pn, "resolve_edge_times", side_effect=fake_resolve):
        targets = await pn.build_targets(db=None, fav_codes={"등교:5602", "하교:3401"}, d=date(2026, 7, 18))

    assert len(calls) == 2
    assert set(targets.keys()) == {"등교:5602", "하교:3401"}


# ── run_push_notification_cycle 오케스트레이션 ────────────────────────────


def _make_sub(id_, endpoint, favorite_codes, last_notified=None):
    sub = MagicMock()
    sub.id = id_
    sub.endpoint = endpoint
    sub.p256dh_key = "p256dh"
    sub.auth_key = "auth"
    sub.favorite_codes = favorite_codes
    sub.last_notified = last_notified or {}
    return sub


@pytest.mark.asyncio
async def test_run_cycle_sends_and_marks_last_notified_within_window():
    """막차 30분 전이면 발송하고 last_notified에 오늘 날짜를 기록한다."""
    sub = _make_sub(1, "https://ep/1", ["등교:5602"])

    db = MagicMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = [sub]
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()

    # now = 21:10, 막차 21:40 → 30분 전(정확히 경계) → 발송 대상
    fixed_now = pn.datetime(2026, 7, 18, 21, 10, tzinfo=pn._KST)
    target = {"first": time(5, 32), "last": time(21, 40), "label": "5602번", "kind": "bus"}

    with patch.object(pn.settings, "VAPID_PRIVATE_KEY", "priv"), patch.object(
        pn.settings, "VAPID_PUBLIC_KEY", "pub"
    ), patch.object(pn, "datetime") as mock_dt, patch.object(
        pn, "build_targets", new=AsyncMock(return_value={"등교:5602": target})
    ), patch.object(pn, "send_web_push") as mock_send:
        mock_dt.now.return_value = fixed_now
        mock_dt.combine = _real_datetime.combine

        summary = await pn.run_push_notification_cycle(db)

    mock_send.assert_called_once()
    assert summary["sent"] == 1
    assert summary["removed"] == 0
    assert sub.last_notified == {"등교:5602:last": "2026-07-18"}


@pytest.mark.asyncio
async def test_run_cycle_skips_if_already_notified_today():
    sub = _make_sub(1, "https://ep/1", ["등교:5602"], last_notified={"등교:5602:last": "2026-07-18"})

    db = MagicMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = [sub]
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()

    fixed_now = pn.datetime(2026, 7, 18, 21, 10, tzinfo=pn._KST)
    target = {"first": time(5, 32), "last": time(21, 40), "label": "5602번", "kind": "bus"}

    with patch.object(pn.settings, "VAPID_PRIVATE_KEY", "priv"), patch.object(
        pn.settings, "VAPID_PUBLIC_KEY", "pub"
    ), patch.object(pn, "datetime") as mock_dt, patch.object(
        pn, "build_targets", new=AsyncMock(return_value={"등교:5602": target})
    ), patch.object(pn, "send_web_push") as mock_send:
        mock_dt.now.return_value = fixed_now
        mock_dt.combine = _real_datetime.combine

        summary = await pn.run_push_notification_cycle(db)

    mock_send.assert_not_called()
    assert summary["sent"] == 0


@pytest.mark.asyncio
async def test_run_cycle_removes_expired_subscription_on_410():
    from pywebpush import WebPushException

    sub = _make_sub(1, "https://ep/1", ["등교:5602"])

    db = MagicMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = [sub]
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()

    fixed_now = pn.datetime(2026, 7, 18, 21, 10, tzinfo=pn._KST)
    target = {"first": time(5, 32), "last": time(21, 40), "label": "5602번", "kind": "bus"}

    fake_response = MagicMock()
    fake_response.status_code = 410
    exc = WebPushException("gone", response=fake_response)

    with patch.object(pn.settings, "VAPID_PRIVATE_KEY", "priv"), patch.object(
        pn.settings, "VAPID_PUBLIC_KEY", "pub"
    ), patch.object(pn, "datetime") as mock_dt, patch.object(
        pn, "build_targets", new=AsyncMock(return_value={"등교:5602": target})
    ), patch.object(pn, "send_web_push", side_effect=exc):
        mock_dt.now.return_value = fixed_now
        mock_dt.combine = _real_datetime.combine

        summary = await pn.run_push_notification_cycle(db)

    assert summary["removed"] == 1
    assert summary["sent"] == 0
    # 만료 구독은 삭제 쿼리가 발행되어야 한다 (execute 호출 중 delete 포함)
    assert db.execute.await_count >= 2


@pytest.mark.asyncio
async def test_run_cycle_no_vapid_keys_skips():
    with patch.object(pn.settings, "VAPID_PRIVATE_KEY", ""), patch.object(
        pn.settings, "VAPID_PUBLIC_KEY", ""
    ):
        summary = await pn.run_push_notification_cycle(db=None)
    assert summary == {"subscriptions": 0, "targets": 0, "sent": 0, "removed": 0}
