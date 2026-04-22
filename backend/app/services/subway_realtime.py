"""서울 지하철 실시간 도착정보 서비스 (정왕·시흥시청·초지).

API 한도: 서울시 운영계정으로 한도 없음
폴링 전략: 피크(07~09, 17~19) 15초 / 비피크 20초 / 새벽(01~05) OFF
캐시 키: subway:realtime:{역명}  TTL: 25초

서울 실시간 API 주요 필드:
  subwayId   노선 ID (1004:4호선, 1075:수인분당선, 1093:서해선)
  updnLine   상행/하행 (상행, 하행)
  bstatnNm   종착역명
  arvlCd     도착코드 (0:진입 1:도착 2:출발 3:전역출발 4:전역진입 5:전역도착 99:운행중)
  arvlMsg2   첫번째 도착메세지 — 짧은 상태 ("전역 도착", "[역명] 진입" 등)
  arvlMsg3   두번째 도착메세지 — 위치/시간 ("12분 후 (광명사거리)", "종합운동장 도착" 등)
  barvlDt    열차 도착 예정 시간 (단위: 초)
  lstcarAt   막차 여부 (1:막차, 0:아님)
  btrainSttus 열차 종류 (일반, 급행, ITX 등)
"""

import logging
import time
import xml.etree.ElementTree as ET

import httpx

from app.core.cache import get_cached_json, get_redis, set_cached_json
from app.core.config import settings

logger = logging.getLogger(__name__)

_BASE_URL = "http://swopenAPI.seoul.go.kr/api/subway/{key}/xml/realtimeStationArrival/0/20/{station}"
_CACHE_TTL = 25

_LINE_MAP = {
    "1004": {"line": "4호선",     "color": "#1B5FAD"},
    "1075": {"line": "수인분당선", "color": "#F5A623"},
    "1093": {"line": "서해선",    "color": "#75bf43"},
}

# 지원하는 역 목록 (API URL용 역명)
STATIONS = ["정왕", "시흥시청", "초지"]

# 노선 우선순위 (같은 열차번호에 여러 노선이 있을 때)
_LINE_PRIORITY = {"1075": 0, "1093": 1, "1004": 2}


def _cache_key(station: str) -> str:
    return f"subway:realtime:{station}"


def _last_fetch_key(station: str) -> str:
    return f"subway:realtime:last_fetch:{station}"


def _parse_seconds(s: str) -> int | None:
    """barvlDt 문자열 → 정수(초). 비어있거나 변환 불가면 None."""
    try:
        v = int(s)
        return v if v >= 0 else None
    except (ValueError, TypeError):
        return None


def parse_rows(rows: list[dict]) -> list[dict]:
    """raw row dict 목록을 파싱해 중복 제거 후 반환.

    같은 btrainNo에 여러 노선이 있으면 수인분당선 > 서해선 > 4호선 우선.
    """
    seen: dict[str, dict] = {}
    for row in rows:
        train_no = row.get("btrainNo", "")
        subway_id = row.get("subwayId", "1004")
        if train_no not in seen:
            seen[train_no] = row
        elif _LINE_PRIORITY.get(subway_id, 99) < _LINE_PRIORITY.get(seen[train_no].get("subwayId", "1004"), 99):
            seen[train_no] = row

    result = []
    for train_no, row in seen.items():
        subway_id = row.get("subwayId", "1004")
        meta = _LINE_MAP.get(subway_id, _LINE_MAP["1004"])
        arrive_seconds = _parse_seconds(row.get("barvlDt", ""))
        result.append({
            "line": meta["line"],
            "direction": row.get("updnLine", ""),
            "destination": row.get("bstatnNm", ""),
            "status_code": int(row.get("arvlCd") or "99"),
            # arvlMsg2: 짧은 상태 메시지 ("전역 도착", "[역명] 진입", "[n]번째 전역" 등)
            "status_msg": row.get("arvlMsg2", ""),
            # arvlMsg3: 위치/시간 메시지 ("12분 후 (광명사거리)", "종합운동장 도착" 등)
            "location_msg": row.get("arvlMsg3", ""),
            # barvlDt: 도착 예정까지 남은 초 (없으면 null)
            "arrive_seconds": arrive_seconds,
            # lstcarAt: 막차 여부
            "is_last_train": row.get("lstcarAt", "0") == "1",
            "train_type": row.get("btrainSttus", ""),
            "train_no": train_no,
            "color": meta["color"],
        })
    return result


async def fetch_realtime(station: str) -> list[dict]:
    """서울 실시간 API 호출 → 파싱 → 반환."""
    url = _BASE_URL.format(key=settings.SEOUL_SUBWAY_KEY, station=station)
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)

    rows = []
    for row_el in root.findall("row"):
        row = {child.tag: (child.text or "") for child in row_el}
        rows.append(row)

    parsed = parse_rows(rows)
    logger.debug("지하철 실시간 fetch: %s → %d건", station, len(parsed))
    return parsed


async def get_realtime_cached(station: str) -> list[dict]:
    """Redis 캐시 hit → 반환, miss → fetch 후 저장."""
    cached = await get_cached_json(_cache_key(station))
    if cached is not None:
        return cached
    data = await fetch_realtime(station)
    await set_cached_json(_cache_key(station), data, ttl=_CACHE_TTL)
    redis = await get_redis()
    await redis.set(_last_fetch_key(station), str(time.time()), ex=300)
    return data


async def fetch_and_cache_realtime(station: str) -> list[dict]:
    """스케줄러용: 강제 fetch 후 캐시 덮어쓰기."""
    data = await fetch_realtime(station)
    await set_cached_json(_cache_key(station), data, ttl=_CACHE_TTL)
    redis = await get_redis()
    await redis.set(_last_fetch_key(station), str(time.time()), ex=300)
    return data


async def get_all_realtime_cached() -> dict[str, list[dict]]:
    """모든 역의 실시간 도착정보를 캐시에서 가져온다.

    역별로 독립 처리: 한 역이 실패해도 나머지 역은 정상 반환.
    """
    results = {}
    for station in STATIONS:
        try:
            results[station] = await get_realtime_cached(station)
        except Exception:
            logger.exception("지하철 실시간 캐시 조회 실패: %s", station)
            results[station] = []
    return results
