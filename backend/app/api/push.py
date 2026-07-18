import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.push import (
    PushFavoritesUpdateRequest,
    PushSubscribeRequest,
    PushUnsubscribeRequest,
)
from app.services.push_subscriptions import (
    delete_subscription,
    update_favorites,
    upsert_subscription,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/push", tags=["push"])


@router.get("/vapid-public-key")
@limiter.limit("60/minute")
async def vapid_public_key(request: Request):
    """VAPID 공개키. 프론트가 이 응답 shape을 그대로 소비하므로 ApiResponse로
    감싸지 않고 계약대로 {"public_key": ...}를 직접 반환한다."""
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe")
@limiter.limit("30/minute")
async def subscribe(
    request: Request,
    payload: PushSubscribeRequest,
    db: AsyncSession = Depends(get_db),
):
    sub = await upsert_subscription(
        db,
        endpoint=payload.endpoint,
        p256dh=payload.keys.p256dh,
        auth=payload.keys.auth,
        favorite_codes=payload.favorite_codes,
    )
    return ApiResponse.ok({"endpoint": sub.endpoint, "favorite_codes": sub.favorite_codes})


@router.put("/subscriptions/favorites")
@limiter.limit("60/minute")
async def update_subscription_favorites(
    request: Request,
    payload: PushFavoritesUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    sub = await update_favorites(db, payload.endpoint, payload.favorite_codes)
    if sub is None:
        raise HTTPException(status_code=404, detail="구독을 찾을 수 없습니다.")
    return ApiResponse.ok({"endpoint": sub.endpoint, "favorite_codes": sub.favorite_codes})


@router.delete("/subscribe")
@limiter.limit("30/minute")
async def unsubscribe(
    request: Request,
    payload: PushUnsubscribeRequest,
    db: AsyncSession = Depends(get_db),
):
    await delete_subscription(db, payload.endpoint)
    return ApiResponse.ok({"endpoint": payload.endpoint})
