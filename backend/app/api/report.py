from fastapi import APIRouter, Query, Request, Response

from app.core.limiter import _client_ip, limiter
from app.schemas.common import ApiResponse
from app.schemas.report import ReportCreate
from app.services.report import get_active_bus_reports, submit_report

router = APIRouter(prefix="/api/v1/report", tags=["report"])


@router.post("")
@limiter.limit("3/minute")
async def create_report(request: Request, payload: ReportCreate):
    result = await submit_report(payload, client_hint=_client_ip(request))
    return ApiResponse.ok(result.model_dump())


@router.get("/active")
@limiter.limit("60/minute")
async def active_reports(
    request: Request,
    response: Response,
    station_key: str = Query(..., max_length=40),
):
    """정류장의 활성(30분 내) 만차·결행 신호 — 도착 카드 경고 뱃지용(F6)."""
    items = await get_active_bus_reports(station_key)
    # 신호는 순간 정보 — 브라우저 캐시 짧게
    response.headers["Cache-Control"] = "public, max-age=30"
    return ApiResponse.ok({"items": items})
