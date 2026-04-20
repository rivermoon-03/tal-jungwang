"""날씨 API 엔드포인트."""

from fastapi import APIRouter, Query, Request

from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.weather import CurrentWeatherResponse, ForecastResponse
from app.services.weather import get_current_weather, get_forecast

router = APIRouter(prefix="/api/v1/weather", tags=["weather"])


@router.get("/current")
@limiter.limit("30/minute")
async def weather_current(request: Request):
    """현재 실황 + 오늘 예보 요약."""
    result = await get_current_weather()
    return ApiResponse[CurrentWeatherResponse].ok(result)


@router.get("/forecast")
@limiter.limit("30/minute")
async def weather_forecast(
    request: Request,
    hours: int = Query(12, ge=1, le=72, description="예보 시간 수 (1~72)"),
):
    """N시간 예보 목록."""
    result = await get_forecast(hours=hours)
    return ApiResponse[ForecastResponse].ok(result)
