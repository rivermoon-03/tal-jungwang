from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.cache import get_cached_json, get_redis, set_cached_json
from app.models.map_marker import MapMarker, MapMarkerRoute

_CACHE_KEY = "map:markers"
_CACHE_TTL = 86400  # 24h — 마커는 거의 변하지 않음


async def get_markers(db: AsyncSession) -> dict:
    cached = await get_cached_json(_CACHE_KEY)
    if cached is not None:
        return cached

    stmt = (
        select(MapMarker)
        .where(MapMarker.is_active.is_(True))
        .options(selectinload(MapMarker.routes).joinedload(MapMarkerRoute.outbound_stop))
        .order_by(MapMarker.sort_order, MapMarker.id)
    )
    rows = (await db.execute(stmt)).scalars().all()

    markers = []
    for m in rows:
        markers.append({
            "key": m.marker_key,
            "type": m.marker_type,
            "name": m.display_name,
            "lat": float(m.lat),
            "lng": float(m.lng),
            "ui_meta": m.ui_meta or {},
            "routes": [
                {
                    "route_number": r.route_number,
                    "route_color": r.route_color,
                    "badge_text": r.badge_text,
                    "outbound_stop_id": r.outbound_stop_id,
                    "outbound_stop_gbis_id": (
                        r.outbound_stop.gbis_station_id if r.outbound_stop else None
                    ),
                    "inbound_stop_id": r.inbound_stop_id,
                    "ui_meta": r.ui_meta or {},
                }
                for r in m.routes
            ],
        })
    result = {"markers": markers}
    await set_cached_json(_CACHE_KEY, result, _CACHE_TTL)
    return result


async def invalidate_markers_cache() -> None:
    """관리 UI에서 마커 편집 시 호출."""
    try:
        redis = await get_redis()
        await redis.delete(_CACHE_KEY)
    except Exception:
        pass
