"""기상청 단기예보 OpenAPI 클라이언트.

- 초단기실황: getUltraSrtNcst (10분 단위)
- 초단기예보: getUltraSrtFcst (매시 30분 발표, +1~+6시간)
- 단기예보:   getVilageFcst  (1시간 단위, 최대 3일)
- 격자 좌표:  정왕동 nx=55, ny=124
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.core.http_client import get_http_client

logger = logging.getLogger(__name__)

# https 필수 — data.go.kr가 평문 HTTP 응답을 끊었다(2026-08 확인: http는 무응답
# 타임아웃, https는 정상 200). 평문으로 두면 모든 호출이 10초 타임아웃 후 빈 배열이
# 되어 기온·바람·예보가 통째로 사라진다. 참고로 서울 열린데이터(지하철 실시간)는
# 반대로 http만 동작하므로 그쪽은 바꾸지 말 것.
BASE_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0"
_KST = ZoneInfo("Asia/Seoul")

# 정왕동 격자 좌표 (기본값)
DEFAULT_NX = 55
DEFAULT_NY = 124


def _kst_now() -> datetime:
    return datetime.now(_KST)


def _base_date_time_ncst() -> tuple[str, str]:
    """초단기실황 baseDatetime — 매시 정각 발표, HH:40부터 조회 가능.

    KMA getUltraSrtNcst 의 base_time 은 HHmm 중 분이 항상 "00" 이며,
    해당 시각 관측치는 HH:40 이후에야 응답에 잡힌다. 분이 40 미만이면
    안전하게 직전 시간을 base_time 으로 사용한다.
    """
    from datetime import timedelta
    now = _kst_now()
    if now.minute < 40:
        now = now - timedelta(hours=1)
    base_time = f"{now.hour:02d}00"
    base_date = now.strftime("%Y%m%d")
    return base_date, base_time


def _base_date_time_ultra_fcst() -> tuple[str, str]:
    """초단기예보 baseDatetime — 매시 30분 발표, HH:45부터 조회 가능.

    getUltraSrtFcst 의 base_time 은 HHmm 중 분이 항상 "30" 이며, 해당 회차는
    HH:45 이후에야 응답에 잡힌다. 분이 45 미만이면 직전 시(hour-1)의 30분
    발표분으로 폴백한다 — 00:10 처럼 자정을 넘기면 전날 23:30 회차가 된다.
    """
    from datetime import timedelta
    now = _kst_now()
    if now.minute < 45:
        now = now - timedelta(hours=1)
    return now.strftime("%Y%m%d"), f"{now.hour:02d}30"


def _base_date_time_fcst() -> tuple[str, str]:
    """단기예보 baseDatetime — 02·05·08·11·14·17·20·23시 발표, 발표 +10분 이후 사용 가능.

    발표 직후(예: 02:00~02:10) 호출하면 직전 회차가 아직 응답에 없을 수 있으므로,
    `발표시각:10` 이전이면 한 단계 이전 회차로 폴백한다.
    """
    from datetime import timedelta
    issue_hours = [2, 5, 8, 11, 14, 17, 20, 23]
    now = _kst_now()
    candidates = [h for h in issue_hours if h < now.hour or (h == now.hour and now.minute >= 10)]
    if candidates:
        prev_hour = candidates[-1]
        return now.strftime("%Y%m%d"), f"{prev_hour:02d}00"
    # 오늘 사용할 회차 없음 → 전날 23시
    yesterday = (now - timedelta(days=1)).strftime("%Y%m%d")
    return yesterday, "2300"


def _common_params(base_date: str, base_time: str, nx: int, ny: int, **extra) -> dict:
    return {
        "serviceKey": settings.DATA_GO_KR_SERVICE_KEY,
        "numOfRows": extra.pop("numOfRows", 1000),
        "pageNo": 1,
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": nx,
        "ny": ny,
        **extra,
    }


# 마지막 호출 실패 사유(프로세스 로컬). 기상청은 키 오류·트래픽 초과도 HTTP 200 에
# resultCode 로 실어 보내기 때문에, 이걸 안 보면 "빈 배열"과 구분되지 않는다.
# Railway 로그를 밖에서 읽을 수 없어 /health 로 노출한다 — 기온이 사라졌을 때
# 원인을 추측하지 않고 확인하기 위한 장치다.
LAST_ERROR: str | None = None


def _record(error: str | None) -> None:
    global LAST_ERROR
    LAST_ERROR = error


def _parse_items(data: dict, *, what: str) -> list[dict]:
    """기상청 응답에서 item 목록을 추출한다. resultCode 가 정상이 아니면 빈 목록."""
    header = ((data or {}).get("response") or {}).get("header") or {}
    code = header.get("resultCode")
    if code not in (None, "00"):
        msg = header.get("resultMsg") or ""
        # 03(NO_DATA)은 발표 전 시간대에 정상적으로 나올 수 있어 사유만 남기고 넘어간다.
        logger.warning("KMA %s 응답 오류: resultCode=%s %s", what, code, msg)
        _record(f"{what}: resultCode={code} {msg}".strip())
        return []
    try:
        items = data["response"]["body"]["items"]["item"]
    except (KeyError, TypeError):
        logger.warning("KMA %s 응답에 item 이 없다", what)
        _record(f"{what}: item 없음")
        return []
    _record(None)
    return items


async def fetch_ultra_srt_ncst(nx: int = DEFAULT_NX, ny: int = DEFAULT_NY) -> list[dict]:
    """초단기실황(getUltraSrtNcst) 조회.

    Returns:
        [{"category": "T1H", "obsrValue": "13"}, ...]
        빈 리스트: API 오류 또는 데이터 없음.
    """
    base_date, base_time = _base_date_time_ncst()
    params = _common_params(base_date, base_time, nx, ny)
    url = f"{BASE_URL}/getUltraSrtNcst"

    try:
        client = await get_http_client()
        resp = await client.get(url, params=params, timeout=10)
        resp.raise_for_status()
        # 키가 틀리면 JSON 이 아니라 XML 오류 문서가 온다 — json() 이 먼저 터진다.
        return _parse_items(resp.json(), what="초단기실황")
    except Exception as exc:
        logger.warning("KMA 초단기실황 오류: %s", exc)
        _record(f"초단기실황: {type(exc).__name__} {exc}"[:200])
    return []


# 초단기예보에서 이동지수·표시가 쓰는 카테고리만 추린다.
# T1H 기온 / RN1 1시간 강수량 / SKY 하늘 / PTY 강수형태 / REH 습도 / WSD 풍속 / LGT 낙뢰
_ULTRA_FCST_CATEGORIES = {"T1H", "RN1", "SKY", "PTY", "REH", "WSD", "LGT"}


async def fetch_ultra_srt_fcst(nx: int = DEFAULT_NX, ny: int = DEFAULT_NY) -> dict | None:
    """초단기예보(getUltraSrtFcst) 조회 — 발표 시각 기준 +1~+6시간 시각별 예보.

    단기예보(1일 8회 발표)와 달리 매시 30분 발표라, 강수·낙뢰 판정을 최대
    3시간 묵은 값 대신 1시간 이내 발표분으로 할 수 있다.

    Returns:
        {"base_date": "20260803", "base_time": "1430",
         "slots": {("20260803", "1500"): {"T1H": "29", "PTY": "0", "LGT": "0", ...}, ...}}
        None: API 오류 또는 데이터 없음 (호출부가 단기예보로 저하 처리).
    """
    base_date, base_time = _base_date_time_ultra_fcst()
    # +1~+6시간 × 카테고리 10종 = 60행이 전부라 rows 는 여유만 두면 된다.
    params = _common_params(base_date, base_time, nx, ny, numOfRows=120)
    url = f"{BASE_URL}/getUltraSrtFcst"

    try:
        client = await get_http_client()
        resp = await client.get(url, params=params, timeout=10)
        resp.raise_for_status()
        # 키가 틀리면 JSON 이 아니라 XML 오류 문서가 온다 — json() 이 먼저 터진다.
        items = _parse_items(resp.json(), what="초단기예보")
    except Exception as exc:
        logger.warning("KMA 초단기예보 오류: %s", exc)
        _record(f"초단기예보: {type(exc).__name__} {exc}"[:200])
        return None
    if not items:
        return None

    slots: dict[tuple[str, str], dict[str, str]] = {}
    for item in items:
        cat = item.get("category")
        if cat not in _ULTRA_FCST_CATEGORIES:
            continue
        key = (item.get("fcstDate", ""), item.get("fcstTime", ""))
        slots.setdefault(key, {})[cat] = item.get("fcstValue", "")
    if not slots:
        return None
    return {"base_date": base_date, "base_time": base_time, "slots": slots}


async def fetch_village_fcst(
    nx: int = DEFAULT_NX,
    ny: int = DEFAULT_NY,
    hours: int = 12,
) -> list[dict]:
    """단기예보(getVilageFcst) 조회.

    Args:
        hours: 몇 시간 치 예보를 가져올지 (최대 72).

    Returns:
        [{"fcstDate": "20260415", "fcstTime": "1500", "category": "TMP", "fcstValue": "16"}, ...]
    """
    base_date, base_time = _base_date_time_fcst()
    # 1시간당 최소 10여개 항목, 여유있게 rows 확보
    num_rows = min(hours * 12 + 24, 1000)
    params = _common_params(base_date, base_time, nx, ny, numOfRows=num_rows)
    url = f"{BASE_URL}/getVilageFcst"

    try:
        client = await get_http_client()
        resp = await client.get(url, params=params, timeout=10)
        resp.raise_for_status()
        return _parse_items(resp.json(), what="단기예보")
    except Exception as exc:
        logger.warning("KMA 단기예보 오류: %s", exc)
        _record(f"단기예보: {type(exc).__name__} {exc}"[:200])
    return []
