from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.services.school import get_calendar, get_notices, is_valid_department, list_departments

router = APIRouter(prefix="/api/v1/school", tags=["school"])


@router.get("/departments")
@limiter.limit("30/minute")
async def departments(request: Request, response: Response):
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
    return ApiResponse.ok(list_departments())


@router.get("/notices")
@limiter.limit("30/minute")
async def notices(
    request: Request,
    response: Response,
    department: str = Query(..., description="학과 코드 (예: ce)"),
    db: AsyncSession = Depends(get_db),
):
    if not is_valid_department(department):
        raise HTTPException(status_code=400, detail=f"지원하지 않는 학과 코드입니다: {department}")

    data = await get_notices(db, department)
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=1800"
    return ApiResponse.ok(data)


@router.get("/calendar")
@limiter.limit("30/minute")
async def calendar(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    data = await get_calendar(db)
    response.headers["Cache-Control"] = "public, max-age=1800, stale-while-revalidate=7200"
    return ApiResponse.ok(data)
