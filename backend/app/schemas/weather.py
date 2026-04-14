"""날씨 API 응답 스키마 (기상청 단기예보 기반)."""

from __future__ import annotations

from pydantic import BaseModel


class TimeBucket(BaseModel):
    label: str        # 오전 / 오후 / 밤 / 새벽
    next_label: str   # 다음 시간대 이름
    next_temp: int | None = None  # 다음 시간대 대표 기온


class WeatherWarning(BaseModel):
    type: str          # rain | cold | heat | pm10
    start_hour: int | None = None  # 비 예상 시작 시각 (없으면 None)
    copy: str          # UI 표시 문구


class HourTemp(BaseModel):
    hour: int
    temp: int


class CurrentWeatherResponse(BaseModel):
    current_temp: int
    current_sky: str          # 맑음 / 구름많음 / 흐림
    icon: str                 # sunny / partly_cloudy / cloudy / rainy / snowy
    rain_prob: int            # 강수확률 (%)
    pm10_grade: str           # 좋음 / 보통 / 나쁨 / 매우나쁨 (API 미제공 시 "알수없음")
    warning: WeatherWarning | None = None
    next_temps: list[HourTemp] = []
    time_bucket: TimeBucket


class ForecastItem(BaseModel):
    hour: int
    date: str     # YYYYMMDD
    temp: int
    sky: str
    icon: str
    rain_prob: int


class ForecastResponse(BaseModel):
    items: list[ForecastItem]
