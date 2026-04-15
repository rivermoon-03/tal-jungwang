"""날씨 서비스 — 기상청 초단기실황 + 단기예보 통합 및 캐시 관리."""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.cache import get_cached_json, set_cached_json
from app.schemas.weather import (
    CurrentWeatherResponse,
    ForecastItem,
    ForecastResponse,
    HourTemp,
    TimeBucket,
    WeatherWarning,
)
from app.services.external.kma import fetch_ultra_srt_ncst, fetch_village_fcst

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")

CACHE_KEY_LIVE = "weather:live"
CACHE_KEY_FORECAST = "weather:forecast"
CACHE_TTL_LIVE = 3600      # 1시간 — 초단기실황, 사용자 요구에 맞춰 호출 빈도 최소화
CACHE_TTL_FORECAST = 10800  # 3시간 — 단기예보 발표 주기(02·05·08·11·14·17·20·23시)와 동기화

# 기상청 SKY 코드 → 문자열/아이콘 매핑
_SKY_LABEL = {"1": "맑음", "3": "구름많음", "4": "흐림"}
_SKY_ICON = {"1": "sunny", "3": "partly_cloudy", "4": "cloudy"}

# 기상청 PTY 코드 → 아이콘 오버라이드
_PTY_ICON = {"1": "rainy", "2": "rainy", "3": "snowy", "4": "rainy", "5": "rainy", "6": "snowy", "7": "rainy"}


def _time_bucket(hour: int) -> TimeBucket:
    """시각(시 단위)을 spec §12.5 기준으로 bucket 분류."""
    if 5 <= hour < 11:
        return TimeBucket(label="오전", next_label="오후")
    if 11 <= hour < 18:
        return TimeBucket(label="오후", next_label="밤")
    if 18 <= hour < 24:
        return TimeBucket(label="밤", next_label="내일 아침")
    # 00:00–05:00
    return TimeBucket(label="새벽", next_label="오늘 오전")


def _ncst_map(items: list[dict]) -> dict[str, str]:
    """초단기실황 item 목록을 {category: value} 딕셔너리로 변환."""
    return {item["category"]: item["obsrValue"] for item in items if "category" in item and "obsrValue" in item}


def _fcst_map(items: list[dict]) -> dict[tuple[str, str], dict[str, str]]:
    """단기예보 item 목록을 {(fcstDate, fcstTime): {category: value}} 로 변환."""
    result: dict[tuple[str, str], dict[str, str]] = {}
    for item in items:
        key = (item.get("fcstDate", ""), item.get("fcstTime", ""))
        result.setdefault(key, {})[item.get("category", "")] = item.get("fcstValue", "")
    return result


def _sky_label(code: str) -> str:
    return _SKY_LABEL.get(code, "알수없음")


def _sky_icon(sky_code: str, pty_code: str = "0") -> str:
    if pty_code != "0":
        return _PTY_ICON.get(pty_code, "rainy")
    return _SKY_ICON.get(sky_code, "cloudy")


def _detect_warning(
    current_temp: int | None,
    rain_prob: int,
    pty_code: str,
    fcst: dict[tuple[str, str], dict[str, str]],
    now: datetime,
) -> WeatherWarning | None:
    """spec §2.3 경고 조건 감지 (우선순위 순)."""
    # 현재 비 오는 중
    if pty_code != "0":
        return WeatherWarning(type="rain", copy="☔ 비 오는 중 · 우산")

    # 강수확률 ≥60% 이고 아직 비 아닌 경우 → 가장 빠른 예보 시각 탐색
    if rain_prob >= 60:
        today = now.strftime("%Y%m%d")
        for h in range(now.hour + 1, 25):
            key = (today, f"{h:02d}00")
            slot = fcst.get(key, {})
            if slot.get("PTY", "0") != "0" or int(slot.get("POP", "0") or 0) >= 60:
                return WeatherWarning(type="rain", start_hour=h, copy=f"☔ {h}시부터 비 · 우산 챙기세요")
        return WeatherWarning(type="rain", copy="☔ 비 예상 · 우산 챙기세요")

    # 한파
    if current_temp is not None and current_temp <= -5:
        return WeatherWarning(type="cold", copy=f"🥶 {current_temp}° 한파 · 두껍게")

    # 폭염
    if current_temp is not None and current_temp >= 32:
        return WeatherWarning(type="heat", copy=f"🥵 {current_temp}° 폭염 · 그늘로")

    return None


def _build_current(
    ncst: dict[str, str],
    fcst: dict[tuple[str, str], dict[str, str]],
    now: datetime,
) -> CurrentWeatherResponse:
    """초단기실황 + 단기예보에서 CurrentWeatherResponse 생성."""
    sky_code = ncst.get("SKY", "1")
    pty_code = ncst.get("PTY", "0")
    rain_prob_raw = ncst.get("POP", None)  # 실황에는 없으므로 예보에서 가져옴

    # 현재 시각 예보 슬롯에서 강수확률 보완
    today = now.strftime("%Y%m%d")
    cur_key = (today, f"{now.hour:02d}00")
    cur_slot = fcst.get(cur_key, {})
    if rain_prob_raw is None:
        rain_prob_raw = cur_slot.get("POP", "0")
    rain_prob = int(rain_prob_raw or 0)

    # 기온: 실황(T1H) → 단기예보(TMP) → None (프론트에서 숨김)
    t1h_raw = ncst.get("T1H")
    tmp_raw = cur_slot.get("TMP")
    if t1h_raw not in (None, ""):
        current_temp = int(float(t1h_raw))
    elif tmp_raw not in (None, ""):
        current_temp = int(float(tmp_raw))
    else:
        current_temp = None

    # 예보 SKY/PTY 가 실황에 없을 경우 보완
    if not sky_code or sky_code == "0":
        sky_code = cur_slot.get("SKY", "1")
    if pty_code == "0":
        pty_code = cur_slot.get("PTY", "0")

    current_sky = _sky_label(sky_code)
    icon = _sky_icon(sky_code, pty_code)

    # 경고
    warning = _detect_warning(current_temp, rain_prob, pty_code, fcst, now)

    # 다음 6시간 기온 목록
    next_temps: list[HourTemp] = []
    for offset in range(1, 7):
        h = (now.hour + offset) % 24
        fcst_date = today if (now.hour + offset) < 24 else _next_date(today)
        key = (fcst_date, f"{h:02d}00")
        slot = fcst.get(key, {})
        tmp = slot.get("TMP")
        if tmp is not None:
            next_temps.append(HourTemp(hour=h, temp=int(float(tmp))))

    # timeBucket
    tb = _time_bucket(now.hour)

    # next_temp: 다음 bucket 대표 기온 (첫 번째 예보 시간 기준)
    next_hour_map = {"오전": 9, "오후": 14, "밤": 21, "새벽": 4}
    next_h = next_hour_map.get(tb.next_label.replace("내일 아침", "오전").replace("오늘 오전", "오전"), 12)
    nkey = (today, f"{next_h:02d}00")
    nslot = fcst.get(nkey, {})
    next_temp_val = nslot.get("TMP")
    if next_temp_val is not None:
        tb.next_temp = int(float(next_temp_val))

    return CurrentWeatherResponse(
        current_temp=current_temp,
        current_sky=current_sky,
        icon=icon,
        rain_prob=rain_prob,
        pm10_grade="알수없음",  # 기상청 단기예보 미제공 — 에어코리아 별도 연동 필요
        warning=warning,
        next_temps=next_temps,
        time_bucket=tb,
    )


def _next_date(date_str: str) -> str:
    from datetime import datetime, timedelta
    d = datetime.strptime(date_str, "%Y%m%d") + timedelta(days=1)
    return d.strftime("%Y%m%d")


def _build_forecast(
    fcst: dict[tuple[str, str], dict[str, str]],
    now: datetime,
    hours: int,
) -> ForecastResponse:
    items: list[ForecastItem] = []
    today = now.strftime("%Y%m%d")

    for offset in range(1, hours + 1):
        h = (now.hour + offset) % 24
        fcst_date = today if (now.hour + offset) < 24 else _next_date(today)
        key = (fcst_date, f"{h:02d}00")
        slot = fcst.get(key, {})
        if not slot:
            continue
        tmp = slot.get("TMP")
        sky = slot.get("SKY", "1")
        pty = slot.get("PTY", "0")
        pop = int(slot.get("POP", "0") or 0)
        if tmp is None:
            continue
        items.append(ForecastItem(
            hour=h,
            date=fcst_date,
            temp=int(float(tmp)),
            sky=_sky_label(sky),
            icon=_sky_icon(sky, pty),
            rain_prob=pop,
        ))

    return ForecastResponse(items=items)


async def get_current_weather() -> CurrentWeatherResponse:
    """현재 날씨 조회 (Redis 캐시 우선, 미스 시 기상청 API)."""
    cached = await get_cached_json(CACHE_KEY_LIVE)
    if cached:
        try:
            return CurrentWeatherResponse.model_validate(cached)
        except Exception:
            pass

    ncst_items = await fetch_ultra_srt_ncst()
    fcst_items = await fetch_village_fcst(hours=12)

    now = datetime.now(_KST)
    ncst = _ncst_map(ncst_items)
    fcst = _fcst_map(fcst_items)

    result = _build_current(ncst, fcst, now)
    await set_cached_json(CACHE_KEY_LIVE, result.model_dump(), CACHE_TTL_LIVE)
    return result


async def get_forecast(hours: int = 12) -> ForecastResponse:
    """N시간 예보 조회 (Redis 캐시 우선, 미스 시 기상청 API)."""
    cached = await get_cached_json(CACHE_KEY_FORECAST)
    if cached:
        try:
            parsed = ForecastResponse.model_validate(cached)
            # 요청한 hours에 맞게 slice
            return ForecastResponse(items=parsed.items[:hours])
        except Exception:
            pass

    fcst_items = await fetch_village_fcst(hours=max(hours, 12))
    now = datetime.now(_KST)
    fcst = _fcst_map(fcst_items)

    result = _build_forecast(fcst, now, hours=max(hours, 12))
    await set_cached_json(CACHE_KEY_FORECAST, result.model_dump(), CACHE_TTL_FORECAST)
    return ForecastResponse(items=result.items[:hours])


async def refresh_weather_cache() -> None:
    """APScheduler에서 주기적으로 호출 — weather:live 캐시를 갱신한다."""
    try:
        ncst_items = await fetch_ultra_srt_ncst()
        fcst_items = await fetch_village_fcst(hours=12)
        now = datetime.now(_KST)
        ncst = _ncst_map(ncst_items)
        fcst = _fcst_map(fcst_items)
        result = _build_current(ncst, fcst, now)
        await set_cached_json(CACHE_KEY_LIVE, result.model_dump(), CACHE_TTL_LIVE)
        logger.info("날씨 캐시 갱신 완료 (temp=%s°)", result.current_temp)
    except Exception:
        logger.exception("날씨 캐시 갱신 실패")
