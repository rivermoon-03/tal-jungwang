"""Web Push 구독 CRUD.

사용자 계정이 없으므로 브라우저의 `PushManager.subscribe()`가 반환하는
`endpoint`(기기+브라우저별 고유 URL)를 기본 키로 삼는다. 새 유저 테이블은 만들지 않는다.
"""
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.push import PushSubscription


async def upsert_subscription(
    db: AsyncSession,
    endpoint: str,
    p256dh: str,
    auth: str,
    favorite_codes: list[str],
    preferences: dict | None = None,
) -> PushSubscription:
    """endpoint 기준 upsert. 이미 있으면 keys/favorite_codes/updated_at만 갱신
    (last_notified는 유지 — 재구독해도 당일 중복 발송 방지 상태를 잃지 않는다).

    preferences가 None이면 건드리지 않는다 — "노선 알림" 토글의 재구독이
    막차 알림 설정을 지우면 안 되기 때문. 값이 오면 최상위 키 단위로 병합한다.
    """
    stmt = select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    result = await db.execute(stmt)
    sub = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if sub is None:
        sub = PushSubscription(
            endpoint=endpoint,
            p256dh_key=p256dh,
            auth_key=auth,
            favorite_codes=favorite_codes,
            last_notified={},
            preferences=preferences or {},
            created_at=now,
            updated_at=now,
        )
        db.add(sub)
    else:
        sub.p256dh_key = p256dh
        sub.auth_key = auth
        sub.favorite_codes = favorite_codes
        if preferences is not None:
            sub.preferences = {**(sub.preferences or {}), **preferences}
        sub.updated_at = now

    await db.commit()
    await db.refresh(sub)
    return sub


async def update_favorites(
    db: AsyncSession, endpoint: str, favorite_codes: list[str]
) -> PushSubscription | None:
    """기존 구독의 favorite_codes만 갱신. 구독 자체가 없으면 None(호출부가 404 처리)."""
    stmt = select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    result = await db.execute(stmt)
    sub = result.scalar_one_or_none()
    if sub is None:
        return None

    sub.favorite_codes = favorite_codes
    sub.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sub)
    return sub


async def update_preferences(
    db: AsyncSession, endpoint: str, preferences: dict
) -> PushSubscription | None:
    """기존 구독의 preferences를 최상위 키 단위로 병합 갱신.

    전체 교체가 아니라 병합인 이유: 알림 종류(last_train, …)별로 최상위 키를
    나눠 쓰므로, 한 종류의 설정 변경이 다른 종류를 지우면 안 된다.
    구독 자체가 없으면 None(호출부가 404 처리).
    """
    stmt = select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    result = await db.execute(stmt)
    sub = result.scalar_one_or_none()
    if sub is None:
        return None

    sub.preferences = {**(sub.preferences or {}), **preferences}
    sub.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(sub)
    return sub


async def delete_subscription(db: AsyncSession, endpoint: str) -> None:
    """endpoint 기준 구독 삭제. 없어도 idempotent(에러 없이 통과)."""
    await db.execute(delete(PushSubscription).where(PushSubscription.endpoint == endpoint))
    await db.commit()
