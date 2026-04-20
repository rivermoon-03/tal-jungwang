from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cached_json, set_cached_json
from app.core.database import get_db
from app.core.limiter import limiter
from app.models.destination import Destination as DestModel
from app.schemas.common import ApiResponse
from app.schemas.destinations import Destination

router = APIRouter(prefix="/api/v1/destinations", tags=["destinations"])

_CACHE_KEY = "destinations:active"
_CACHE_TTL = 3600  # 목적지 목록은 거의 바뀌지 않음 — 1시간 캐시


@router.get("")
@limiter.limit("60/minute")
async def destinations(request: Request, db: AsyncSession = Depends(get_db)):
    """활성 상태의 하교 목적지 목록을 sort_order 순으로 반환한다."""
    cached = await get_cached_json(_CACHE_KEY)
    if cached is not None:
        return ApiResponse[list[Destination]].ok(cached)

    rows = (
        await db.execute(
            select(DestModel)
            .where(DestModel.is_active.is_(True))
            .order_by(DestModel.sort_order)
        )
    ).scalars().all()

    data = [
        Destination(
            code=r.code,
            name=r.name,
            kind=r.kind,
            lat=float(r.lat) if r.lat is not None else None,
            lng=float(r.lng) if r.lng is not None else None,
            sort_order=r.sort_order,
        )
        for r in rows
    ]
    await set_cached_json(_CACHE_KEY, [d.model_dump() for d in data], ttl=_CACHE_TTL)
    return ApiResponse[list[Destination]].ok(data)
