"""실사용자 Web Vitals 수집. 값은 /metrics 의 히스토그램으로만 남기고 저장하지 않는다."""

from typing import Literal

from fastapi import APIRouter, Request
from prometheus_client import Histogram
from pydantic import BaseModel, Field

from app.core.limiter import limiter
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/api/v1/vitals", tags=["vitals"])

# 라벨 값은 아래 Literal 로만 받는다. 클라이언트가 보낸 문자열이 시계열을 늘리지 못하게 한다.
WEB_VITALS_MS = Histogram(
    "tj_web_vitals_ms",
    "실사용자 Web Vitals (ms)",
    ["name", "page"],
    buckets=(100, 250, 500, 1000, 1800, 2500, 4000, 8000, 15000),
)
WEB_VITALS_CLS = Histogram(
    "tj_web_vitals_cls",
    "실사용자 CLS 점수",
    ["page"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0),
)


class VitalSample(BaseModel):
    name: Literal["LCP", "FCP", "TTFB", "INP", "CLS"]
    value: float = Field(ge=0, le=600_000)
    page: Literal["home", "transit", "cafeteria", "more", "other"] = "other"


@router.post("")
@limiter.limit("30/minute")
async def report_vitals(request: Request, sample: VitalSample):
    if sample.name == "CLS":
        WEB_VITALS_CLS.labels(sample.page).observe(min(sample.value, 10.0))
    else:
        WEB_VITALS_MS.labels(sample.name, sample.page).observe(sample.value)
    return ApiResponse.ok({"recorded": True})
