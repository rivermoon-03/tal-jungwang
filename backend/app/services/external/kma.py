"""기상청 단기예보 OpenAPI 클라이언트.

- 초단기실황: getUltraSrtNcst (10분 단위)
- 단기예보:   getVilageFcst  (1시간 단위, 최대 3일)
- 격자 좌표:  정왕동 nx=55, ny=124
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0"
_KST = ZoneInfo("Asia/Seoul")

# 정왕동 격자 좌표 (기본값)
DEFAULT_NX = 55
DEFAULT_NY = 124


def _kst_now() -> datetime:
    return datetime.now(_KST)


def _base_date_time_ncst() -> tuple[str, str]:
    """초단기실황 baseDatetime — 10분 단위로 내림."""
    now = _kst_now()
    # 매 10분 단위 발표 (실제로는 매 정시 +40분 발표, 안전하게 최근 정각 사용)
    minute = (now.minute // 10) * 10
    base_time = f"{now.hour:02d}{minute:02d}"
    base_date = now.strftime("%Y%m%d")
    return base_date, base_time


def _base_date_time_fcst() -> tuple[str, str]:
    """단기예보 baseDatetime — 02·05·08·11·14·17·20·23시 발표, 직전 회차 사용."""
    issue_hours = [2, 5, 8, 11, 14, 17, 20, 23]
    now = _kst_now()
    prev_hour = max((h for h in issue_hours if h <= now.hour), default=23)
    if prev_hour > now.hour:
        # 자정 이전 마지막 발표(23시)가 어제
        from datetime import timedelta
        yesterday = (now - timedelta(days=1)).strftime("%Y%m%d")
        return yesterday, "2300"
    base_date = now.strftime("%Y%m%d")
    base_time = f"{prev_hour:02d}00"
    return base_date, base_time


def _common_params(base_date: str, base_time: str, nx: int, ny: int, **extra) -> dict:
    return {
        "serviceKey": settings.KMA_API_KEY,
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
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        return _parse_items(resp.json())
    except httpx.HTTPError as exc:
        logger.warning("KMA 초단기실황 HTTP 오류: %s", exc)
    except Exception as exc:
        logger.warning("KMA 초단기실황 파싱 오류: %s", exc)
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
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        return _parse_items(resp.json())
    except httpx.HTTPError as exc:
        logger.warning("KMA 단기예보 HTTP 오류: %s", exc)
    except Exception as exc:
        logger.warning("KMA 단기예보 파싱 오류: %s", exc)
    return []
