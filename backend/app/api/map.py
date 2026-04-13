from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.map import MapMarkersResponse
from app.services.map_markers import get_markers

router = APIRouter(prefix="/api/v1/map", tags=["map"])


@router.get("/markers")
async def map_markers(
    db: AsyncSession = Depends(get_db),
):
    result = await get_markers(db)
    return ApiResponse[MapMarkersResponse].ok(result)
