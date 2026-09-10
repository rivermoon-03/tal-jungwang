"""수집 정지 경보 — 도착 감지가 멈추면 Discord 로 @everyone 을 부른다.

2026-08 에 도착 감지가 3주간 멈췄는데 아무 지표도 이상을 말하지 않았다. 같은
폴링 사이클이 쓰는 혼잡 로그는 주당 24,000건으로 멀쩡했고 서버도 GBIS 도
정상이었다. 재배포로 복구됐지만 그동안 누구도 몰랐다.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest

from app.services import bus_monitor

KST = ZoneInfo("Asia/Seoul")


def _db_returning(last_detected):
    """max(arrived_at) 로 last_detected 를 돌려주는 AsyncSessionLocal 대역."""
    result = MagicMock()
    result.scalar_one_or_none = MagicMock(return_value=last_detected)
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=db)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return MagicMock(return_value=ctx)


@pytest.mark.asyncio
async def test_no_alert_when_collection_is_recent():
    """최근에 감지됐으면 아무도 부르지 않는다."""
    recent = datetime.now(timezone.utc) - timedelta(hours=2)
    with (
        patch.object(bus_monitor, "AsyncSessionLocal", _db_returning(recent)),
        patch.object(bus_monitor, "_post", new=AsyncMock()) as post,
    ):
        result = await bus_monitor.check_arrival_collection_stalled()

    assert result["stalled"] is False
    assert result["alerted"] is False
    post.assert_not_awaited()


@pytest.mark.asyncio
async def test_alert_when_stalled_for_two_days():
    """48시간을 넘기면 @everyone 으로 부른다."""
    stale = datetime.now(timezone.utc) - timedelta(days=3)
    with (
        patch.object(bus_monitor, "AsyncSessionLocal", _db_returning(stale)),
        patch.object(bus_monitor, "_stall_alert_on_cooldown", new=AsyncMock(return_value=False)),
        patch.object(bus_monitor, "_mark_stall_alert_sent", new=AsyncMock()) as mark,
        patch.object(bus_monitor, "_post", new=AsyncMock()) as post,
    ):
        result = await bus_monitor.check_arrival_collection_stalled()

    assert result["stalled"] is True
    assert result["alerted"] is True
    post.assert_awaited_once()
    content = post.await_args.args[0]
    assert "@everyone" in content
    assert post.await_args.kwargs["mention_everyone"] is True
    mark.assert_awaited_once()


@pytest.mark.asyncio
async def test_threshold_is_two_days():
    """임계는 48시간이다. 47시간에는 부르지 않는다."""
    assert bus_monitor.STALL_ALERT_THRESHOLD_HOURS == 48

    almost = datetime.now(timezone.utc) - timedelta(hours=47)
    with (
        patch.object(bus_monitor, "AsyncSessionLocal", _db_returning(almost)),
        patch.object(bus_monitor, "_post", new=AsyncMock()) as post,
    ):
        result = await bus_monitor.check_arrival_collection_stalled()

    assert result["stalled"] is False
    post.assert_not_awaited()


@pytest.mark.asyncio
async def test_cooldown_suppresses_repeat_alerts():
    """같은 장애로 매시 @everyone 을 울리지 않는다."""
    stale = datetime.now(timezone.utc) - timedelta(days=5)
    with (
        patch.object(bus_monitor, "AsyncSessionLocal", _db_returning(stale)),
        patch.object(bus_monitor, "_stall_alert_on_cooldown", new=AsyncMock(return_value=True)),
        patch.object(bus_monitor, "_post", new=AsyncMock()) as post,
    ):
        result = await bus_monitor.check_arrival_collection_stalled()

    assert result["stalled"] is True
    assert result["alerted"] is False
    post.assert_not_awaited()


@pytest.mark.asyncio
async def test_alert_when_no_detection_ever():
    """감지 기록이 아예 없어도 정지로 본다."""
    with (
        patch.object(bus_monitor, "AsyncSessionLocal", _db_returning(None)),
        patch.object(bus_monitor, "_stall_alert_on_cooldown", new=AsyncMock(return_value=False)),
        patch.object(bus_monitor, "_mark_stall_alert_sent", new=AsyncMock()),
        patch.object(bus_monitor, "_post", new=AsyncMock()) as post,
    ):
        result = await bus_monitor.check_arrival_collection_stalled()

    assert result["stalled"] is True
    assert result["alerted"] is True
    assert "도착 감지 기록이 아예 없습니다" in post.await_args.args[0]


@pytest.mark.asyncio
async def test_regular_report_never_mentions_everyone():
    """정기 보고가 사람을 부르면 곧 아무도 안 읽는다."""
    with patch.object(bus_monitor, "_post", new=AsyncMock()) as post:
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(all=MagicMock(return_value=[])))
        ctx = MagicMock()
        ctx.__aenter__ = AsyncMock(return_value=db)
        ctx.__aexit__ = AsyncMock(return_value=False)
        with patch.object(bus_monitor, "AsyncSessionLocal", MagicMock(return_value=ctx)):
            await bus_monitor.send_bus_arrival_report(window_hours=3)

    for call in post.await_args_list:
        assert "@everyone" not in call.args[0]
        assert call.kwargs.get("mention_everyone") in (None, False)
