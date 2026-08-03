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


class WalkFactor(BaseModel):
    """이동 지수가 본 항목 하나. 툴팁이 판정 근거를 그대로 보여주기 위한 재료다."""

    key: str        # temp | rain | dust | lightning
    label: str      # 기온 / 강수확률 / 미세먼지 / 낙뢰
    value: str      # "31°" / "0%" / "좋음" / "감지됨" / "정보 없음"
    decisive: bool = False  # 이 항목이 등급을 결정했는가


class WalkIndex(BaseModel):
    """F5 이동 지수 — 강수확률·기온·미세먼지를 묶은 4단계 걷기 판정."""

    level: str   # good | ok | transit | indoor
    label: str   # 걷기 좋음 / 무난함 / 대중교통 권장 / 실내 권장
    reason: str  # 판정 근거 한 줄 (예: "14시 소나기 60%")
    # 항목별 근거. 칩만 보면 "왜 걷기 좋은데?"에 답이 없어서, 탭하면 이걸 펼친다.
    factors: list[WalkFactor] = []
    # 강수 판정 출처("14:30 발표 초단기예보 기준" 등). 구버전 캐시 응답이면 None.
    source_label: str | None = None


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
