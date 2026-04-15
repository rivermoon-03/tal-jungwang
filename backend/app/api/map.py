from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.map import MapMarkersResponse
from app.services.map_markers import get_markers

router = APIRouter(prefix="/api/v1/map", tags=["map"])


@router.get("/markers")
async def map_markers(
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await get_markers(db)
    # 마커는 거의 안 바뀜 — 브라우저/프록시도 오래 캐시 (SW는 SWR로 재검증)
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
    return ApiResponse[MapMarkersResponse].ok(result)
