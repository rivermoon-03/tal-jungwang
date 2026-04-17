"""기상청 단기예보 OpenAPI 클라이언트.

- 초단기실황: getUltraSrtNcst (10분 단위)
- 단기예보:   getVilageFcst  (1시간 단위, 최대 3일)
- 격자 좌표:  정왕동 nx=55, ny=124
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.core.http_client import get_http_client

logger = logging.getLogger(__name__)

BASE_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0"
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


def _parse_items(data: dict) -> list[dict]:
    """기상청 응답에서 item 목록을 추출한다."""
    try:
        return data["response"]["body"]["items"]["item"]
    except (KeyError, TypeError):
        return []


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
        return _parse_items(resp.json())
    except Exception as exc:
        logger.warning("KMA 초단기실황 오류: %s", exc)
    return []


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
        return _parse_items(resp.json())
    except Exception as exc:
        logger.warning("KMA 단기예보 오류: %s", exc)
    return []
