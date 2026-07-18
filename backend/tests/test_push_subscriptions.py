"""push_subscriptions 서비스(구독 CRUD) 단위 테스트. DB는 mock으로 대체."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.push_subscriptions import (
    delete_subscription,
    update_favorites,
    upsert_subscription,
)


def _db_returning(existing):
    db = MagicMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = existing
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.mark.asyncio
async def test_upsert_subscription_creates_new_when_absent():
    db = _db_returning(None)

    sub = await upsert_subscription(
        db,
        endpoint="https://ep/1",
        p256dh="p",
        auth="a",
        favorite_codes=["등교:5602"],
    )

    db.add.assert_called_once()
    added = db.add.call_args[0][0]
    assert added.endpoint == "https://ep/1"
    assert added.p256dh_key == "p"
    assert added.auth_key == "a"
    assert added.favorite_codes == ["등교:5602"]
    assert added.last_notified == {}
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_upsert_subscription_updates_existing_and_keeps_last_notified():
    existing = MagicMock()
    existing.favorite_codes = ["등교:5602"]
    existing.last_notified = {"등교:5602:last": "2026-07-17"}
    db = _db_returning(existing)

    sub = await upsert_subscription(
        db,
        endpoint="https://ep/1",
        p256dh="new_p",
        auth="new_a",
        favorite_codes=["하교:3401"],
    )

    assert sub is existing
    assert existing.p256dh_key == "new_p"
    assert existing.auth_key == "new_a"
    assert existing.favorite_codes == ["하교:3401"]
    # 기존 last_notified는 upsert가 건드리지 않는다 (재구독해도 당일 중복발송 방지 유지)
    assert existing.last_notified == {"등교:5602:last": "2026-07-17"}
    db.add.assert_not_called()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_favorites_returns_none_when_missing():
    db = _db_returning(None)
    result = await update_favorites(db, "https://ep/none", ["등교:5602"])
    assert result is None
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_favorites_updates_existing():
    existing = MagicMock()
    existing.favorite_codes = ["등교:5602"]
    db = _db_returning(existing)

    result = await update_favorites(db, "https://ep/1", ["shuttle:등교"])

    assert result is existing
    assert existing.favorite_codes == ["shuttle:등교"]
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_subscription_is_idempotent():
    db = MagicMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()

    await delete_subscription(db, "https://ep/not-exist")

    db.execute.assert_awaited_once()
    db.commit.assert_awaited_once()
