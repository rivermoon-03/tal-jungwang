"""서울 지하철 실시간 도착정보 서비스 (정왕·시흥시청·초지).

API 한도: 서울시 운영계정으로 한도 없음
폴링 전략: 피크(07~09, 17~19) 15초 / 비피크 60초 / 새벽(01~05) OFF
캐시 키: subway:realtime:{역명}  TTL: 90초
"""

import time
import xml.etree.ElementTree as ET

import httpx

from app.core.cache import get_cached_json, get_redis, set_cached_json
from app.core.config import settings

_BASE_URL = "http://swopenAPI.seoul.go.kr/api/subway/{key}/xml/realtimeStationArrival/0/20/{station}"
_CACHE_TTL = 90

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
        result.append({
            "line": meta["line"],
            "direction": row.get("updnLine", ""),
            "destination": row.get("bstatnNm", ""),
            "status_code": int(row.get("arvlCd") or "99"),
            "status_msg": row.get("arvlMsg2", ""),
            "current_station": row.get("arvlMsg3", ""),
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

    return parse_rows(rows)


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
    """모든 역의 실시간 도착정보를 캐시에서 가져온다."""
    results = {}
    for station in STATIONS:
        results[station] = await get_realtime_cached(station)
    return results
