from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.services.school import (
    get_board_notices,
    get_calendar,
    get_library_hours,
    is_valid_category,
)

router = APIRouter(prefix="/api/v1/school", tags=["school"])


@router.get("/board-notices")
@limiter.limit("30/minute")
async def board_notices(
    request: Request,
    response: Response,
    category: str = Query("all", description="all | academic | scholarship | job | extra | dorm"),
    db: AsyncSession = Depends(get_db),
):
    """전교 게시판 공지(DS1). 학과 공지(RSS)는 2026-08 개편에서 제거됐다."""
    if not is_valid_category(category):
        raise HTTPException(status_code=400, detail=f"지원하지 않는 카테고리입니다: {category}")

    data = await get_board_notices(db, category)
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=1800"
    return ApiResponse.ok(data)


@router.get("/library-hours")
@limiter.limit("30/minute")
async def library_hours(request: Request, response: Response):
    """도서관 열람실 개관시간(F7 시험기간 카드용)."""
    data = await get_library_hours()
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=21600"
    return ApiResponse.ok(data)


@router.get("/calendar")
@limiter.limit("30/minute")
async def calendar(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    data = await get_calendar(db)
    response.headers["Cache-Control"] = "public, max-age=1800, stale-while-revalidate=7200"
    return ApiResponse.ok(data)
