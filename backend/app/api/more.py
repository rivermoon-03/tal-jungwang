from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.common import ApiResponse
from app.services.more import get_info, get_links, get_notices

router = APIRouter(prefix="/api/v1/more", tags=["more"])


@router.get("/notices")
async def notices(db: AsyncSession = Depends(get_db)):
    data = await get_notices(db)
    return ApiResponse.ok(data)


@router.get("/links")
async def links(db: AsyncSession = Depends(get_db)):
    data = await get_links(db)
    return ApiResponse.ok(data)


@router.get("/info")
async def info(db: AsyncSession = Depends(get_db)):
    data = await get_info(db)
    if data is None:
        return ApiResponse.fail("NOT_FOUND", "앱 정보가 없습니다.")
    return ApiResponse.ok(data)
