from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cached_json, set_cached_json
from app.models.more import AppInfo, AppLink, Notice

_TTL_NOTICES = 300    # 5분
_TTL_LINKS   = 3600   # 1시간
_TTL_INFO    = 3600   # 1시간


async def get_notices(db: AsyncSession) -> list[dict]:
    cached = await get_cached_json("more:notices")
    if cached is not None:
        return cached

    rows = await db.execute(
        select(Notice)
        .where(Notice.is_active == True)  # noqa: E712
        .order_by(Notice.created_at.desc())
    )
    notices = rows.scalars().all()
    data = [
        {
            "id": n.id,
            "title": n.title,
            "content": n.content,
            "created_at": n.created_at.isoformat(),
        }
        for n in notices
    ]
    await set_cached_json("more:notices", data, _TTL_NOTICES)
    return data


async def get_links(db: AsyncSession) -> list[dict]:
    cached = await get_cached_json("more:links")
    if cached is not None:
        return cached

    rows = await db.execute(
        select(AppLink)
        .where(AppLink.is_active == True)  # noqa: E712
        .order_by(AppLink.sort_order)
    )
    links = rows.scalars().all()
    data = [
        {"id": lnk.id, "icon": lnk.icon, "label": lnk.label, "url": lnk.url, "sort_order": lnk.sort_order}
        for lnk in links
    ]
    await set_cached_json("more:links", data, _TTL_LINKS)
    return data


async def get_info(db: AsyncSession) -> dict | None:
    cached = await get_cached_json("more:info")
    if cached is not None:
        return cached

    row = await db.get(AppInfo, 1)
    if not row:
        return None
    data = {
        "version": row.version,
        "description": row.description,
        "feedback_url": row.feedback_url,
    }
    await set_cached_json("more:info", data, _TTL_INFO)
    return data


async def invalidate_notices() -> None:
    from app.core.cache import get_redis
    r = await get_redis()
    await r.delete("more:notices")


async def invalidate_links() -> None:
    from app.core.cache import get_redis
    r = await get_redis()
    await r.delete("more:links")


async def invalidate_info() -> None:
    from app.core.cache import get_redis
    r = await get_redis()
    await r.delete("more:info")
