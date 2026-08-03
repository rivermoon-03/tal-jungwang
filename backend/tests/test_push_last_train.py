"""B1 정왕역 막차 알림 단위 테스트.

순수 함수(서비스일 계산·프리퍼런스 정규화·막차 계산·payload 카피)와
run_last_train_push_cycle 오케스트레이션(발송 대상 선정·자정 경계·Redis 중복 방지)을
검증한다. 시간표/Redis/pywebpush는 전부 mock — 시각은 KST tz-aware로 고정한다.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import push_notifier as pn

_KST = pn._KST

# 평일 시간표 예시 — 하행(오이도 방면) 막차가 자정을 넘는다(00:32 → 서비스일+1).
_TIMETABLE = {
    "up": [
        {"depart_at": "05:10", "destination": "왕십리"},
        {"depart_at": "12:00", "destination": "왕십리"},
        {"depart_at": "23:52", "destination": "왕십리"},
    ],
    "down": [
        # 자정 넘김 막차가 문자열 정렬로는 맨 앞에 온다 — 이게 핵심 함정.
        {"depart_at": "00:32", "destination": "오이도"},
        {"depart_at": "05:40", "destination": "오이도"},
        {"depart_at": "23:58", "destination": "오이도"},
    ],
}


# ── 서비스일 계산 ─────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "now, expected",
    [
        (datetime(2026, 7, 17, 23, 22, tzinfo=_KST), date(2026, 7, 17)),  # 늦은 밤 → 당일
        (datetime(2026, 7, 18, 0, 2, tzinfo=_KST), date(2026, 7, 17)),    # 자정 직후 → 전날
        (datetime(2026, 7, 18, 3, 59, tzinfo=_KST), date(2026, 7, 17)),   # 04시 직전 → 전날
        (datetime(2026, 7, 18, 4, 0, tzinfo=_KST), date(2026, 7, 18)),    # 04시 정각 → 당일
        (datetime(2026, 7, 18, 12, 0, tzinfo=_KST), date(2026, 7, 18)),
    ],
)
def test_last_train_service_date(now, expected):
    assert pn.last_train_service_date(now) == expected


# ── 프리퍼런스 정규화 ─────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "preferences, expected",
    [
        (None, (False, 30)),
        ({}, (False, 30)),
        ({"last_train": {"enabled": True, "lead_min": 15}}, (True, 15)),
        ({"last_train": {"enabled": True, "lead_min": 60}}, (True, 60)),
        ({"last_train": {"enabled": False, "lead_min": 30}}, (False, 30)),
        # 화이트리스트 밖 lead_min은 기본 30으로 강제 (크론이 죽으면 안 된다)
        ({"last_train": {"enabled": True, "lead_min": 45}}, (True, 30)),
        ({"last_train": {"enabled": True}}, (True, 30)),
        ({"last_train": "이상한값"}, (False, 30)),
    ],
)
def test_resolve_last_train_pref(preferences, expected):
    assert pn.resolve_last_train_pref(preferences) == expected


# ── 막차 계산 (자정 넘김 보정) ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_compute_last_trains_midnight_spill_goes_to_next_day():
    service_d = date(2026, 7, 17)  # 금요일
    with patch.object(
        pn.subway_service, "get_timetable", new=AsyncMock(return_value=_TIMETABLE)
    ) as gt:
        result = await pn.compute_last_trains(db=None, service_d=service_d)

    # 시간표는 서비스일 날짜로 조회한다 (day_type quirk는 subway 서비스가 처리)
    gt.assert_awaited_once_with(None, service_d)

    assert [lt["key"] for lt in result] == ["up", "down"]  # depart_dt 오름차순
    up, down = result
    # 상행 막차 23:52 — 당일
    assert up["depart_dt"] == datetime(2026, 7, 17, 23, 52, tzinfo=_KST)
    assert up["destination"] == "왕십리"
    # 하행 막차 00:32 — 문자열 정렬상 첫 항목이지만 실제로는 다음날 새벽 막차
    assert down["depart_dt"] == datetime(2026, 7, 18, 0, 32, tzinfo=_KST)
    assert down["destination"] == "오이도"


@pytest.mark.asyncio
async def test_compute_last_trains_empty_direction_is_skipped():
    with patch.object(
        pn.subway_service,
        "get_timetable",
        new=AsyncMock(return_value={"up": [], "down": _TIMETABLE["down"]}),
    ):
        result = await pn.compute_last_trains(db=None, service_d=date(2026, 7, 17))
    assert [lt["key"] for lt in result] == ["down"]


# ── payload 카피 (디자인 시안 확정) ────────────────────────────────────────


def _lt(key, dt, dest):
    return {"key": key, "depart_dt": dt, "destination": dest}


def test_build_last_train_payload_two_directions():
    payload = pn.build_last_train_payload(
        30,
        [
            _lt("up", datetime(2026, 7, 17, 23, 52, tzinfo=_KST), "왕십리"),
            _lt("down", datetime(2026, 7, 18, 0, 32, tzinfo=_KST), "오이도"),
        ],
    )
    assert payload["title"] == "막차 30분 전"
    assert payload["body"] == "정왕역 왕십리행 막차 23:52 · 오이도행 00:32"
    assert payload["url"] == "/schedule"


def test_build_last_train_payload_single_direction():
    payload = pn.build_last_train_payload(
        15, [_lt("down", datetime(2026, 7, 18, 0, 32, tzinfo=_KST), "오이도")]
    )
    assert payload["title"] == "막차 15분 전"
    assert payload["body"] == "정왕역 오이도행 막차 00:32"


def test_build_last_train_payload_falls_back_to_direction_label():
    payload = pn.build_last_train_payload(
        60, [_lt("up", datetime(2026, 7, 17, 23, 52, tzinfo=_KST), "")]
    )
    # destination이 비면 "상행행" 같은 오문 대신 방향 라벨을 쓴다
    assert payload["body"] == "정왕역 상행 막차 23:52"


# ── run_last_train_push_cycle 오케스트레이션 ──────────────────────────────


def _make_sub(id_, preferences):
    sub = MagicMock()
    sub.id = id_
    sub.endpoint = f"https://ep/{id_}"
    sub.p256dh_key = "p256dh"
    sub.auth_key = "auth"
    sub.preferences = preferences
    return sub


def _make_db(subs):
    db = MagicMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = subs
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    return db


def _make_redis(existing=None):
    redis = MagicMock()
    redis.get = AsyncMock(return_value=existing)
    redis.set = AsyncMock()
    return redis


def _cycle_patches(redis, timetable=_TIMETABLE):
    """VAPID·시간표·Redis를 한 번에 mock하는 공용 컨텍스트 목록."""
    return (
        patch.object(pn.settings, "VAPID_PRIVATE_KEY", "priv"),
        patch.object(pn.settings, "VAPID_PUBLIC_KEY", "pub"),
        patch.object(pn.subway_service, "get_timetable", new=AsyncMock(return_value=timetable)),
        patch.object(pn, "get_redis", new=AsyncMock(return_value=redis)),
    )


@pytest.mark.asyncio
async def test_cycle_sends_at_exact_lead_minute_and_marks_dedup():
    """막차(23:52) − 30분 == 23:22 정확히 그 분에 발송하고 dedup 키를 기록한다."""
    sub = _make_sub(1, {"last_train": {"enabled": True, "lead_min": 30}})
    db = _make_db([sub])
    redis = _make_redis()
    now = datetime(2026, 7, 17, 23, 22, 0, tzinfo=_KST)

    p1, p2, p3, p4 = _cycle_patches(redis)
    with p1, p2, p3, p4, patch.object(pn, "send_web_push") as mock_send:
        summary = await pn.run_last_train_push_cycle(db, now=now)

    assert summary["sent"] == 1
    assert summary["eligible"] == 1
    mock_send.assert_called_once()
    payload = mock_send.call_args[0][1]
    assert payload["title"] == "막차 30분 전"
    # 두 방향 모두 아직 안 떠났으므로 병기
    assert payload["body"] == "정왕역 왕십리행 막차 23:52 · 오이도행 00:32"
    redis.set.assert_awaited_once()
    key = redis.set.await_args[0][0]
    assert key == "push:last_train:sent:1:2026-07-17"
    assert redis.set.await_args.kwargs["ex"] == 26 * 3600


@pytest.mark.asyncio
async def test_cycle_no_send_when_minute_does_not_match():
    sub = _make_sub(1, {"last_train": {"enabled": True, "lead_min": 30}})
    db = _make_db([sub])
    redis = _make_redis()
    now = datetime(2026, 7, 17, 23, 23, 0, tzinfo=_KST)  # 23:22가 아님

    p1, p2, p3, p4 = _cycle_patches(redis)
    with p1, p2, p3, p4, patch.object(pn, "send_web_push") as mock_send:
        summary = await pn.run_last_train_push_cycle(db, now=now)

    mock_send.assert_not_called()
    assert summary["sent"] == 0


@pytest.mark.asyncio
async def test_cycle_lead_min_60_matches_one_hour_before():
    sub = _make_sub(1, {"last_train": {"enabled": True, "lead_min": 60}})
    db = _make_db([sub])
    redis = _make_redis()
    now = datetime(2026, 7, 17, 22, 52, 0, tzinfo=_KST)  # 23:52 − 60분

    p1, p2, p3, p4 = _cycle_patches(redis)
    with p1, p2, p3, p4, patch.object(pn, "send_web_push") as mock_send:
        summary = await pn.run_last_train_push_cycle(db, now=now)

    assert summary["sent"] == 1
    mock_send.assert_called_once()


@pytest.mark.asyncio
async def test_cycle_midnight_crossing_uses_previous_service_day_and_drops_departed():
    """토요일 00:02 KST: 금요일 시간표의 하행 막차(00:32) 30분 전.

    - 서비스일은 전날(금)로 계산되어야 하고,
    - 이미 떠난 왕십리행(23:52)은 본문에서 빠져야 한다.
    """
    sub = _make_sub(7, {"last_train": {"enabled": True, "lead_min": 30}})
    db = _make_db([sub])
    redis = _make_redis()
    now = datetime(2026, 7, 18, 0, 2, 0, tzinfo=_KST)

    mock_timetable = AsyncMock(return_value=_TIMETABLE)
    with patch.object(pn.settings, "VAPID_PRIVATE_KEY", "priv"), patch.object(
        pn.settings, "VAPID_PUBLIC_KEY", "pub"
    ), patch.object(pn.subway_service, "get_timetable", new=mock_timetable), patch.object(
        pn, "get_redis", new=AsyncMock(return_value=redis)
    ), patch.object(pn, "send_web_push") as mock_send:
        summary = await pn.run_last_train_push_cycle(db, now=now)

    assert summary["sent"] == 1
    # 시간표는 전날(서비스일) 날짜로 조회됐다
    mock_timetable.assert_awaited_once_with(db, date(2026, 7, 17))
    payload = mock_send.call_args[0][1]
    assert payload["body"] == "정왕역 오이도행 막차 00:32"
    # dedup 키도 서비스일 기준 — 23:22 발송분과 같은 키라 하루 1건이 보장된다
    assert redis.set.await_args[0][0] == "push:last_train:sent:7:2026-07-17"


@pytest.mark.asyncio
async def test_cycle_dedup_key_blocks_second_send_same_service_day():
    """23:22에 이미 발송된 구독은 00:02의 하행 막차 매칭에서 스킵된다."""
    sub = _make_sub(1, {"last_train": {"enabled": True, "lead_min": 30}})
    db = _make_db([sub])
    redis = _make_redis(existing="2026-07-17")  # 이미 발송됨
    now = datetime(2026, 7, 18, 0, 2, 0, tzinfo=_KST)

    p1, p2, p3, p4 = _cycle_patches(redis)
    with p1, p2, p3, p4, patch.object(pn, "send_web_push") as mock_send:
        summary = await pn.run_last_train_push_cycle(db, now=now)

    mock_send.assert_not_called()
    assert summary["sent"] == 0
    redis.set.assert_not_awaited()


@pytest.mark.asyncio
async def test_cycle_disabled_or_missing_pref_not_eligible():
    subs = [
        _make_sub(1, {"last_train": {"enabled": False, "lead_min": 30}}),
        _make_sub(2, {}),
        _make_sub(3, None),
    ]
    db = _make_db(subs)
    redis = _make_redis()
    now = datetime(2026, 7, 17, 23, 22, 0, tzinfo=_KST)

    p1, p2, p3, p4 = _cycle_patches(redis)
    with p1, p2, p3, p4, patch.object(pn, "send_web_push") as mock_send:
        summary = await pn.run_last_train_push_cycle(db, now=now)

    assert summary["subscriptions"] == 3
    assert summary["eligible"] == 0
    mock_send.assert_not_called()


@pytest.mark.asyncio
async def test_cycle_skips_night_gap_hours():
    """02:00~03:59 KST는 운행 공백 — DB 조회 없이 즉시 반환."""
    db = MagicMock()
    db.execute = AsyncMock()

    with patch.object(pn.settings, "VAPID_PRIVATE_KEY", "priv"), patch.object(
        pn.settings, "VAPID_PUBLIC_KEY", "pub"
    ):
        summary = await pn.run_last_train_push_cycle(
            db, now=datetime(2026, 7, 18, 2, 30, tzinfo=_KST)
        )

    assert summary.get("skipped") == "night_gap"
    db.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_cycle_removes_gone_subscription_on_410():
    from pywebpush import WebPushException

    sub = _make_sub(1, {"last_train": {"enabled": True, "lead_min": 30}})
    db = _make_db([sub])
    redis = _make_redis()
    now = datetime(2026, 7, 17, 23, 22, 0, tzinfo=_KST)

    fake_response = MagicMock()
    fake_response.status_code = 410
    exc = WebPushException("gone", response=fake_response)

    p1, p2, p3, p4 = _cycle_patches(redis)
    with p1, p2, p3, p4, patch.object(pn, "send_web_push", side_effect=exc):
        summary = await pn.run_last_train_push_cycle(db, now=now)

    assert summary["removed"] == 1
    assert summary["sent"] == 0
    # 실패했으므로 dedup 마킹도 없어야 한다
    redis.set.assert_not_awaited()
    assert db.execute.await_count >= 2  # select + delete


@pytest.mark.asyncio
async def test_cycle_no_vapid_keys_skips():
    with patch.object(pn.settings, "VAPID_PRIVATE_KEY", ""), patch.object(
        pn.settings, "VAPID_PUBLIC_KEY", ""
    ):
        summary = await pn.run_last_train_push_cycle(db=None)
    assert summary == {"subscriptions": 0, "eligible": 0, "sent": 0, "removed": 0}
