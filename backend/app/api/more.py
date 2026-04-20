from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.services.more import get_info, get_links, get_notices

router = APIRouter(prefix="/api/v1/more", tags=["more"])


@router.get("/notices")
@limiter.limit("30/minute")
async def notices(request: Request, db: AsyncSession = Depends(get_db)):
    data = await get_notices(db)
    return ApiResponse.ok(data)


@router.get("/links")
@limiter.limit("30/minute")
async def links(request: Request, db: AsyncSession = Depends(get_db)):
    data = await get_links(db)
    return ApiResponse.ok(data)


@router.get("/info")
@limiter.limit("30/minute")
async def info(request: Request, db: AsyncSession = Depends(get_db)):
    data = await get_info(db)
    if data is None:
        return ApiResponse.fail("NOT_FOUND", "앱 정보가 없습니다.")
    return ApiResponse.ok(data)
