"""날씨 서비스 — 기상청 초단기실황 + 단기예보 통합 및 캐시 관리."""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.cache import get_cached_json, get_or_fetch_with_lock, get_redis, set_cached_json
from app.schemas.weather import (
    CurrentWeatherResponse,
    ForecastItem,
    ForecastResponse,
    HourTemp,
    TimeBucket,
    WeatherWarning,
)
from app.services.external.kma import (
    _base_date_time_fcst,
    fetch_ultra_srt_fcst,
    fetch_ultra_srt_ncst,
    fetch_village_fcst,
)

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")

CACHE_KEY_LIVE = "weather:live"
CACHE_KEY_FORECAST = "weather:forecast"
CACHE_KEY_FORECAST_RAW = "weather:forecast:raw"  # KMA API 응답 원본(tuple 키 직렬화형)
CACHE_TTL_LIVE = 3600      # 1시간 — 초단기실황, 사용자 요구에 맞춰 호출 빈도 최소화
# 외부 API 장애로 실황이 비어버린 응답(기온 null)을 1시간 굳히면 그동안 히어로에
# 기온이 통째로 사라진다(2026-08 실제 장애). 저하 응답은 짧게만 캐시해 자가회복시킨다.
CACHE_TTL_LIVE_DEGRADED = 120
# 실황 수집 실패 사유. Railway 로그를 밖에서 읽을 수 없어 /health 로 내보낸다 —
# "기온이 또 안 나온다"를 추측이 아니라 사유로 답하기 위한 장치다.
CACHE_KEY_LIVE_ERROR = "weather:live:error"
CACHE_TTL_LIVE_ERROR = 6 * 3600
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


def _serialize_fcst_map(fcst: dict[tuple[str, str], dict[str, str]]) -> dict[str, dict[str, str]]:
    """tuple 키 fcst dict를 JSON 직렬화 가능한 형태로 변환 (키: "YYYYMMDD_HHMM")."""
    return {f"{date}_{time}": values for (date, time), values in fcst.items()}


def _deserialize_fcst_map(fcst_json: dict[str, dict[str, str]]) -> dict[tuple[str, str], dict[str, str]]:
    """JSON 직렬화된 fcst dict를 tuple 키로 복원."""
    result: dict[tuple[str, str], dict[str, str]] = {}
    for key_str, values in fcst_json.items():
        parts = key_str.split("_", 1)
        if len(parts) == 2:
            result[(parts[0], parts[1])] = values
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

    # 기온: 실황(T1H) → 현재시각 단기예보(TMP) → 가장 가까운 미래 단기예보(TMP) → None
    t1h_raw = ncst.get("T1H")
    tmp_raw = cur_slot.get("TMP")
    if t1h_raw not in (None, ""):
        current_temp = int(float(t1h_raw))
    elif tmp_raw not in (None, ""):
        current_temp = int(float(tmp_raw))
    else:
        # 단기예보(baseTime=HH00)는 HH+1 시각부터 예보가 시작되므로 cur_slot에 TMP가 없을 수 있음.
        # 가장 가까운 예보 시각(1~3시간 이내 슬롯)에서 기온을 폴백으로 끌어온다.
        fallback_temp = None
        for offset in range(1, 4):
            h = (now.hour + offset) % 24
            fcst_date = today if (now.hour + offset) < 24 else _next_date(today)
            slot = fcst.get((fcst_date, f"{h:02d}00"), {})
            val = slot.get("TMP")
            if val not in (None, ""):
                fallback_temp = int(float(val))
                break
        current_temp = fallback_temp

    # 예보 SKY/PTY 가 실황에 없을 경우 보완
    if not sky_code or sky_code == "0":
        sky_code = cur_slot.get("SKY")
        if not sky_code:
            for offset in range(1, 4):
                h = (now.hour + offset) % 24
                fcst_date = today if (now.hour + offset) < 24 else _next_date(today)
                slot = fcst.get((fcst_date, f"{h:02d}00"), {})
                if slot.get("SKY"):
                    sky_code = slot["SKY"]
                    break
        sky_code = sky_code or "1"
    if pty_code == "0":
        pty_code = cur_slot.get("PTY") or "0"

    current_sky = _sky_label(sky_code)
    icon = _sky_icon(sky_code, pty_code)

    # 풍속(WSD, m/s): 실황(초단기실황) → 현재 시각 예보 슬롯 → None.
    # 정왕동은 건물풍 영향으로 체감 바람이 세서 프론트에서 '정왕풍'으로 표시한다.
    wsd_raw = ncst.get("WSD")
    if wsd_raw in (None, ""):
        wsd_raw = cur_slot.get("WSD")
    try:
        wind_speed = round(float(wsd_raw), 1) if wsd_raw not in (None, "") else None
    except (TypeError, ValueError):
        wind_speed = None

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
        wind_speed=wind_speed,
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


# ── F5 이동 지수 — 미세먼지(에어코리아) 결합 ────────────────────────────

CACHE_KEY_AIR = "weather:air"
CACHE_TTL_AIR = 3600  # 에어코리아는 시간 단위 발표 — 1h면 충분

# 초단기예보(+1~+6h) — 강수·낙뢰 판정용. 스케줄러 잡 없이 이동지수 계산 시
# cache-aside 로만 채운다(에어코리아와 같은 패턴). 발표가 매시 30분이라 1h TTL이면
# 항상 한 회차 이내 신선도이고, 실패는 캐시하지 않아 복구 즉시 반영된다.
CACHE_KEY_ULTRA_FCST = "weather:ultra_fcst"
CACHE_TTL_ULTRA_FCST = 3600

# level별 표시 라벨. 판정은 compute_walk_index가 한다.
_WALK_LABEL = {
    "good": "걷기 좋음",
    "ok": "무난함",
    "transit": "대중교통 권장",
    "indoor": "실내 권장",
}


def compute_walk_index(
    rain_prob: int,
    temp: int | None,
    pm_grade: str | None,
    *,
    rain_soon: bool | None = None,
    lightning: bool = False,
    source_label: str | None = None,
) -> dict:
    """강수·기온·미세먼지(+낙뢰) → 4단계 걷기 지수(level/label/reason/factors).

    보수적 우선순위: 낙뢰 → indoor, 미세 매우나쁨/극한 기온 → indoor,
    비 예보·나쁨 → transit.
    - rain_soon 이 주어지면(초단기예보 성공) 강수 판정은 향후 1~2시간 창의
      실제 강수형태(PTY)로 한다 — 단기예보 강수확률(rain_prob)은 표시용으로만
      남는다. None 이면 기존 강수확률 임계값(60/30%)으로 폴백한다.
    - lightning 은 창 내 낙뢰(LGT>0) 감지 — 우산으로 답이 없어 무조건 indoor.
    - 미세먼지 등급이 없으면(None/알수없음) 날씨만으로 판정한다 — 에어코리아
      활용신청 전에도 지수는 뜬다.
    """
    t = temp if temp is not None else 20
    # 강수 판정 입력: 초단기예보(+1~+2h 창) 우선, 없으면 단기예보 강수확률
    rain_transit = rain_soon if rain_soon is not None else rain_prob >= 60
    rain_caution = False if rain_soon is not None else rain_prob >= 30
    rain_reason = "곧 비 예보" if rain_soon else f"강수확률 {rain_prob}%"

    # decisive: 등급을 실제로 끌어내린 항목. 어느 것도 아니면 None(= 다 괜찮다).
    if lightning:
        decisive, reason = "lightning", "낙뢰 예보"
        level = "indoor"
    elif pm_grade == "매우나쁨" or t <= -10 or t >= 35:
        decisive = "dust" if pm_grade == "매우나쁨" else "temp"
        reason = f"미세먼지 {pm_grade}" if decisive == "dust" else f"기온 {t}°"
        level = "indoor"
    elif rain_transit or pm_grade == "나쁨" or t <= -5 or t >= 33:
        if rain_transit:
            decisive, reason = "rain", rain_reason
        elif pm_grade == "나쁨":
            decisive, reason = "dust", f"미세먼지 {pm_grade}"
        else:
            decisive, reason = "temp", f"기온 {t}°"
        level = "transit"
    elif rain_caution or t >= 30 or t <= 0:
        if rain_caution:
            decisive, reason = "rain", f"강수확률 {rain_prob}%"
        else:
            decisive, reason = "temp", f"기온 {t}°"
        level = "ok"
    else:
        decisive, reason = None, "지금 날씨가 걷기에 좋아요"
        level = "good"

    # 기온이 없을 때 20°로 가정하고 판정하므로, 그 사실을 값에 드러낸다 —
    # 툴팁이 "기온 20°"라고 단정하면 관측 실패를 사실처럼 보여주게 된다.
    factors = [
        {"key": "temp", "label": "기온",
         "value": f"{temp}°" if temp is not None else "정보 없음",
         "decisive": decisive == "temp"},
        {"key": "rain", "label": "강수확률", "value": f"{rain_prob}%",
         "decisive": decisive == "rain"},
        {"key": "dust", "label": "미세먼지",
         "value": pm_grade if pm_grade and pm_grade != "알수없음" else "정보 없음",
         "decisive": decisive == "dust"},
    ]
    if lightning:
        # 낙뢰 행은 감지됐을 때만 노출한다 — 평상시 "낙뢰 없음" 행은 소음이다.
        factors.append({"key": "lightning", "label": "낙뢰", "value": "감지됨",
                        "decisive": decisive == "lightning"})
    return {
        "level": level,
        "label": _WALK_LABEL[level],
        "reason": reason,
        "factors": factors,
        # 판정 출처(예: "14:30 발표 초단기예보 기준") — 팝오버 하단에 노출.
        "source_label": source_label,
    }


async def _get_air_quality_cached() -> dict | None:
    """에어코리아 실측(정왕동) — 1h 캐시. 미승인/장애 시 None(캐시 안 함: 승인 즉시 반영)."""
    cached = await get_cached_json(CACHE_KEY_AIR)
    if cached:
        return cached
    from app.services.external.airkorea import fetch_air_quality

    air = await fetch_air_quality()
    if air:
        await set_cached_json(CACHE_KEY_AIR, air, CACHE_TTL_AIR)
    return air


async def _get_ultra_fcst_cached() -> dict | None:
    """초단기예보(+1~+6h) — 1h 캐시. 실패 시 None(캐시 안 함: 복구 즉시 반영).

    에어코리아(_get_air_quality_cached)와 같은 cache-aside 패턴 — 스케줄러 잡
    없이 이동지수 계산이 필요할 때만 채운다. slots 는 tuple 키라 JSON 으로 갈 때
    단기예보 raw 와 같은 "YYYYMMDD_HHMM" 직렬화를 재사용한다.
    """
    cached = await get_cached_json(CACHE_KEY_ULTRA_FCST)
    if cached and isinstance(cached.get("slots"), dict):
        return {
            "base_time": cached.get("base_time", ""),
            "slots": _deserialize_fcst_map(cached["slots"]),
        }

    ultra = await fetch_ultra_srt_fcst()
    if ultra:
        await set_cached_json(
            CACHE_KEY_ULTRA_FCST,
            {"base_date": ultra["base_date"], "base_time": ultra["base_time"],
             "slots": _serialize_fcst_map(ultra["slots"])},
            CACHE_TTL_ULTRA_FCST,
        )
        return {"base_time": ultra["base_time"], "slots": ultra["slots"]}
    return None


def _format_issue_label(base_time: str, kind: str) -> str:
    """발표시각 "1430" → "14:30 발표 초단기예보 기준" 출처 문구."""
    hhmm = f"{base_time[:2]}:{base_time[2:]}" if len(base_time) == 4 else base_time
    return f"{hhmm} 발표 {kind} 기준"


def _walk_precip_inputs(ultra: dict | None, now: datetime) -> tuple[bool | None, bool, str]:
    """이동지수의 강수·낙뢰 입력을 초단기예보 향후 1~2시간 창에서 뽑는다.

    Returns:
        (rain_soon, lightning, source_label)
        rain_soon    — True/False: 창 내 강수형태(PTY≠0) 유무.
                       None: 초단기 없음 → 단기예보 강수확률로 폴백 판정.
        lightning    — 창 내 낙뢰(LGT>0) 감지 여부.
        source_label — 판정 출처 문구(팝오버 하단 노출용).
    """
    # 폴백 출처: 지금 시각 기준으로 유효한 단기예보 회차(1일 8회 발표).
    fallback_label = _format_issue_label(_base_date_time_fcst()[1], "단기예보")
    slots = (ultra or {}).get("slots") or {}
    today = now.strftime("%Y%m%d")
    window: list[dict] = []
    for offset in (1, 2):
        h = (now.hour + offset) % 24
        date = today if now.hour + offset < 24 else _next_date(today)
        slot = slots.get((date, f"{h:02d}00"))
        if slot:
            window.append(slot)
    if not window:
        # 초단기 조회 실패이거나 캐시가 낡아 창에 걸리는 슬롯이 없다 → 조용한 저하.
        return None, False, fallback_label

    rain_soon = any(s.get("PTY", "0") not in ("", "0") for s in window)
    lightning = False
    for s in window:
        try:
            if float(s.get("LGT") or 0) > 0:
                lightning = True
                break
        except (TypeError, ValueError):
            continue
    return rain_soon, lightning, _format_issue_label(ultra.get("base_time", ""), "초단기예보")


def _apply_air(
    result: CurrentWeatherResponse,
    air: dict | None,
    ultra: dict | None = None,
    now: datetime | None = None,
) -> CurrentWeatherResponse:
    """live 캐시 shape을 건드리지 않고 응답 직전에 미세먼지·지수를 얹는다."""
    if air:
        result.pm10 = air.get("pm10")
        result.pm25 = air.get("pm25")
        result.pm25_grade = air.get("pm25_grade")
        if air.get("pm10_grade"):
            result.pm10_grade = air["pm10_grade"]
    pm_grade = result.pm25_grade or (result.pm10_grade if result.pm10_grade != "알수없음" else None)
    rain_soon, lightning, source_label = _walk_precip_inputs(ultra, now or datetime.now(_KST))
    result.walk_index = compute_walk_index(
        result.rain_prob, result.current_temp, pm_grade,
        rain_soon=rain_soon, lightning=lightning, source_label=source_label,
    )
    return result


async def record_live_error() -> None:
    """직전 기상청 호출이 왜 비었는지 남긴다(/health 의 weather_error)."""
    from app.services.external import kma as _kma

    await set_cached_json(
        CACHE_KEY_LIVE_ERROR,
        {"reason": _kma.LAST_ERROR or "사유 미상", "at": datetime.now(_KST).isoformat()},
        CACHE_TTL_LIVE_ERROR,
    )


async def store_live_cache(result: CurrentWeatherResponse) -> None:
    """실황 캐시 기록 — 저하 응답(기온 없음)을 정상 TTL로 굳히지 않는다.

    기온이 없다는 건 기상청 실황 수집이 실패했다는 뜻이다. 그 상태를 1시간짜리
    캐시로 박아두면 외부 장애가 끝난 뒤에도 한 시간 동안 히어로에 기온이 안 뜬다.
      - 이미 정상 값이 캐시돼 있으면 덮지 않는다(직전 관측치가 빈 값보다 낫다)
      - 없으면 짧게만(120s) 캐시해 곧바로 재시도하게 한다
    """
    if result.current_temp is not None:
        await set_cached_json(CACHE_KEY_LIVE, result.model_dump(), CACHE_TTL_LIVE)
        try:
            redis = await get_redis()
            await redis.delete(CACHE_KEY_LIVE_ERROR)
        except Exception:
            pass
        return

    await record_live_error()

    existing = await get_cached_json(CACHE_KEY_LIVE)
    if existing and existing.get("current_temp") is not None:
        logger.warning("실황 수집 실패 — 기존 정상 캐시를 유지한다")
        return
    logger.warning("실황 수집 실패 — 저하 응답을 %d초만 캐시한다", CACHE_TTL_LIVE_DEGRADED)
    await set_cached_json(CACHE_KEY_LIVE, result.model_dump(), CACHE_TTL_LIVE_DEGRADED)


async def get_current_weather() -> CurrentWeatherResponse:
    """현재 날씨 조회 (Redis 캐시 우선, 미스 시 기상청 API) + 미세먼지·이동 지수.

    캐시 미스는 single-flight 로 묶는다. 예전에는 평범한 cache-aside 라, 실황이
    비어 저하 캐시(120초)가 깔리면 사용자 수만큼 기상청을 두 번씩(실황+예보)
    두드렸다 — 외부가 흔들릴 때 호출량이 오히려 폭증해 회복을 늦추는 구조였다.
    """

    async def _fetch() -> dict:
        ncst_items = await fetch_ultra_srt_ncst()
        fcst_items = await fetch_village_fcst(hours=12)
        now = datetime.now(_KST)
        result = _build_current(_ncst_map(ncst_items), _fcst_map(fcst_items), now)
        if result.current_temp is None:
            await record_live_error()
        return result.model_dump()

    def _ttl(payload: dict) -> int:
        # 기온이 없으면 저하 응답 — 1시간짜리로 굳히지 않고 짧게만 둔다.
        return CACHE_TTL_LIVE if payload.get("current_temp") is not None else CACHE_TTL_LIVE_DEGRADED

    payload = await get_or_fetch_with_lock(CACHE_KEY_LIVE, _ttl, _fetch)
    base = CurrentWeatherResponse.model_validate(payload)
    # 이동지수 강수·낙뢰 판정용 초단기예보 — cache-aside 라 실패해도 응답은 나간다.
    return _apply_air(base, await _get_air_quality_cached(), await _get_ultra_fcst_cached())


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


async def refresh_weather_live_cache() -> bool:
    """APScheduler에서 매시간 호출 — 초단기실황(weather:live) 캐시만 갱신.

    현재 기온/체감/실황 상태를 1시간 주기로 갱신한다.
    _build_current()에 필요한 예보 데이터는 refresh_weather_forecast_cache()에서
    이미 저장된 raw 캐시(weather:forecast:raw)를 먼저 시도한다.
    캐시 미스 시에만 폴백으로 fetch_village_fcst()를 호출하여 API 호출을 최소화한다.

    이를 통해 매일 단기예보 API(fetch_village_fcst)는 3시간 주기(8회/일)만 호출되고,
    live job(24회/일)에서는 fetch_village_fcst를 호출하지 않는다.
    """
    try:
        ncst_items = await fetch_ultra_srt_ncst()
        now = datetime.now(_KST)
        ncst = _ncst_map(ncst_items)

        # 1순위: 3시간마다 저장된 raw 예보 캐시 사용
        fcst_raw_cached = await get_cached_json(CACHE_KEY_FORECAST_RAW)
        if fcst_raw_cached:
            try:
                fcst = _deserialize_fcst_map(fcst_raw_cached)
                logger.debug("초단기실황 갱신: 예보 캐시 재사용 (slots=%d)", len(fcst))
            except Exception as e:
                logger.warning("예보 캐시 역직렬화 실패: %s, 폴백으로 fetch", e)
                fcst_raw_cached = None
        else:
            fcst_raw_cached = None

        # 2순위: 캐시 미스 또는 역직렬화 실패 → 폴백으로 fetch
        if not fcst_raw_cached:
            logger.debug("초단기실황 갱신: 예보 캐시 미스, fetch_village_fcst 폴백")
            fcst_items = await fetch_village_fcst(hours=12)
            fcst = _fcst_map(fcst_items)

        result = _build_current(ncst, fcst, now)
        await store_live_cache(result)
        logger.info("초단기실황 캐시 갱신 완료 (temp=%s°)", result.current_temp)
        # 기온이 없으면 수집이 실패한 것이다. 예전에는 여기서도 "성공"으로 쳐서
        # /health 의 freshness 가 멀쩡해 보였고, 기온이 며칠 비어 있어도 아무도
        # 몰랐다. 관측치가 실제로 들어왔을 때만 성공으로 돌려준다.
        return result.current_temp is not None
    except Exception:
        logger.exception("초단기실황 캐시 갱신 실패")
        return False


async def refresh_weather_forecast_cache() -> None:
    """APScheduler에서 3시간 주기(02·05·08·11·14·17·20·23시 발표 후)로 호출 —
    단기예보(weather:forecast) 캐시만 갱신.

    KMA 단기예보는 3시간 주기 발표이므로, 매시간 호출하면 불필요한 API 중복 호출이 발생한다.
    이 함수는 발표 후 충분한 시간(발표+15분 등)에 한 번만 호출되어야 한다.

    또한 원본 fcst dict(tuple 키)를 별도로 캐시(_forecast_raw)해두어,
    refresh_weather_live_cache()에서 재사용하고 불필요한 fetch_village_fcst 호출을 피하게 한다.
    """
    try:
        fcst_items = await fetch_village_fcst(hours=72)  # 최대 72시간
        now = datetime.now(_KST)
        fcst = _fcst_map(fcst_items)
        result = _build_forecast(fcst, now, hours=72)

        # 예보 응답 저장 (사용자 요청 응답용)
        await set_cached_json(CACHE_KEY_FORECAST, result.model_dump(), CACHE_TTL_FORECAST)

        # 원본 fcst dict를 직렬화해서 저장 (live job에서 재사용용)
        fcst_serialized = _serialize_fcst_map(fcst)
        await set_cached_json(CACHE_KEY_FORECAST_RAW, fcst_serialized, CACHE_TTL_FORECAST)

        logger.info("단기예보 캐시 갱신 완료 (items=%d, raw fcst=%d slots)", len(result.items), len(fcst))
    except Exception:
        logger.exception("단기예보 캐시 갱신 실패")


async def refresh_weather_cache() -> None:
    """호환성 유지용 — 초단기실황 + 단기예보를 동시 갱신 (진구 코드에서 호출 가능).

    새 코드에서는 _weather_live_refresh_job과 _weather_forecast_refresh_job으로 분리.
    """
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
