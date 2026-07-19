from fastapi import APIRouter, Request

from app.core.limiter import _client_ip, limiter
from app.schemas.common import ApiResponse
from app.schemas.report import ReportCreate
from app.services.report import submit_report

router = APIRouter(prefix="/api/v1/report", tags=["report"])


@router.post("")
@limiter.limit("3/minute")
async def create_report(request: Request, payload: ReportCreate):
    result = await submit_report(payload, client_hint=_client_ip(request))
    return ApiResponse.ok(result.model_dump())
