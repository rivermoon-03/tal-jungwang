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


class WalkIndex(BaseModel):
    """F5 이동 지수 — 강수확률·기온·미세먼지를 묶은 4단계 걷기 판정."""

    level: str   # good | ok | transit | indoor
    label: str   # 걷기 좋음 / 무난함 / 대중교통 권장 / 실내 권장
    reason: str  # 판정 근거 한 줄 (예: "14시 소나기 60%")


class CurrentWeatherResponse(BaseModel):
    current_temp: int | None = None
    current_sky: str          # 맑음 / 구름많음 / 흐림
    icon: str                 # sunny / partly_cloudy / cloudy / rainy / snowy
    rain_prob: int            # 강수확률 (%)
    wind_speed: float | None = None  # 풍속 (m/s, WSD) — 정왕동 '정왕풍' 표시용. 미제공 시 None
    pm10_grade: str           # 좋음 / 보통 / 나쁨 / 매우나쁨 (API 미제공 시 "알수없음")
    pm25_grade: str | None = None  # 초미세먼지 등급 (에어코리아 미승인/장애 시 None)
    pm10: int | None = None   # ㎍/㎥
    pm25: int | None = None   # ㎍/㎥
    walk_index: WalkIndex | None = None
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
