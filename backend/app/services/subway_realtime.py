"""서울 지하철 실시간 도착정보 서비스.

API 한도: 일 1,000회 (정왕역 단일 역)
폴링 전략: 피크(07~09, 17~19) 30초 / 비피크 90초 / 새벽(01~05) OFF
캐시 키: subway:realtime:정왕  TTL: 35초
"""

import time
import xml.etree.ElementTree as ET

import httpx

from app.core.cache import get_cached_json, get_redis, set_cached_json
from app.core.config import settings

_BASE_URL = "http://swopenAPI.seoul.go.kr/api/subway/{key}/xml/realtimeStationArrival/0/20/정왕"
_CACHE_KEY = "subway:realtime:정왕"
_CACHE_TTL = 35
_LAST_FETCH_KEY = "subway:realtime:last_fetch"

_LINE_MAP = {
    "1004": {"line": "4호선", "color": "#1B5FAD"},
    "1075": {"line": "수인분당선", "color": "#F5A623"},
}


def parse_rows(rows: list[dict]) -> list[dict]:
    """raw row dict 목록을 파싱해 중복 제거 후 반환.

    중복 제거 기준: btrainNo.
    같은 btrainNo에 1004·1075 둘 다 있으면 1075(수인분당선) 우선.
    """
    seen: dict[str, dict] = {}
    for row in rows:
        train_no = row.get("btrainNo", "")
        subway_id = row.get("subwayId", "1004")
        if train_no not in seen:
            seen[train_no] = row
        elif subway_id == "1075":
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


async def fetch_realtime() -> list[dict]:
    """서울 실시간 API 호출 → 파싱 → 반환."""
    url = _BASE_URL.format(key=settings.SEOUL_SUBWAY_KEY)
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)

    rows = []
    for row_el in root.findall("row"):
        row = {child.tag: (child.text or "") for child in row_el}
        rows.append(row)

    return parse_rows(rows)


async def get_realtime_cached() -> list[dict]:
    """Redis 캐시 hit → 반환, miss → fetch 후 저장."""
    cached = await get_cached_json(_CACHE_KEY)
    if cached is not None:
        return cached
    data = await fetch_realtime()
    await set_cached_json(_CACHE_KEY, data, ttl=_CACHE_TTL)
    redis = await get_redis()
    await redis.set(_LAST_FETCH_KEY, str(time.time()), ex=300)
    return data


async def fetch_and_cache_realtime() -> list[dict]:
    """스케줄러용: 강제 fetch 후 캐시 덮어쓰기."""
    data = await fetch_realtime()
    await set_cached_json(_CACHE_KEY, data, ttl=_CACHE_TTL)
    redis = await get_redis()
    await redis.set(_LAST_FETCH_KEY, str(time.time()), ex=300)
    return data
