import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.push import (
    PushFavoritesUpdateRequest,
    PushPreferencesUpdateRequest,
    PushSubscribeRequest,
    PushUnsubscribeRequest,
)
from app.services.push_subscriptions import (
    delete_subscription,
    update_favorites,
    update_preferences,
    upsert_subscription,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/push", tags=["push"])


@router.get("/vapid-public-key")
@limiter.limit("60/minute")
async def vapid_public_key(request: Request):
    """VAPID 공개키. 프로젝트 공용 apiFetch(frontend/src/hooks/useApi.js)는 모든
    응답이 {success, data} shape이라고 가정하고 success가 없으면 예외를 던지므로,
    다른 엔드포인트와 동일하게 ApiResponse로 감싼다(래핑하지 않으면 프론트 구독
    플로우가 항상 실패한다)."""
    return ApiResponse.ok({"public_key": settings.VAPID_PUBLIC_KEY})


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
        # 생략(None)이면 기존 preferences 유지 — 노선 알림 재구독이 막차 설정을 안 지운다.
        preferences=payload.preferences.model_dump() if payload.preferences else None,
    )
    return ApiResponse.ok(
        {
            "endpoint": sub.endpoint,
            "favorite_codes": sub.favorite_codes,
            "preferences": sub.preferences,
        }
    )


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


@router.put("/subscriptions/preferences")
@limiter.limit("60/minute")
async def update_subscription_preferences(
    request: Request,
    payload: PushPreferencesUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """구독별 알림 프리퍼런스(막차 알림 등) 갱신. lead_min은 스키마의 Literal(15/30/60)로 검증."""
    sub = await update_preferences(db, payload.endpoint, payload.preferences.model_dump())
    if sub is None:
        raise HTTPException(status_code=404, detail="구독을 찾을 수 없습니다.")
    return ApiResponse.ok({"endpoint": sub.endpoint, "preferences": sub.preferences})


@router.delete("/subscribe")
@limiter.limit("30/minute")
async def unsubscribe(
    request: Request,
    payload: PushUnsubscribeRequest,
    db: AsyncSession = Depends(get_db),
):
    await delete_subscription(db, payload.endpoint)
    return ApiResponse.ok({"endpoint": payload.endpoint})
