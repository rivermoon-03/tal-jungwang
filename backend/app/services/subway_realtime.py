"""서울 지하철 실시간 도착정보 서비스 (정왕·시흥시청·초지).

API 한도: 서울시 운영계정으로 한도 없음
폴링 전략: 피크(07~09, 17~19) 15초 / 비피크 20초 / 새벽(01~05) OFF
캐시 키: subway:realtime:{역명}  TTL: 30초

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
import re
import time
import xml.etree.ElementTree as ET

import httpx

from app.core.cache import get_cached_json, get_redis, set_cached_json
from app.core.config import settings

logger = logging.getLogger(__name__)

_BASE_URL = "http://swopenAPI.seoul.go.kr/api/subway/{key}/xml/realtimeStationArrival/0/20/{station}"
_CACHE_TTL = 30

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


_MIN_RE = re.compile(r'(\d+)분\s*후')
_BRACKET_NUM_RE = re.compile(r'^\[(\d+)\](.+)$')  # "[4]번째 전역"
_BRACKET_NM_RE = re.compile(r'^\[([^\]]+)\]\s*(.+)$')  # "[역명] 진입"


def _parse_seconds(s: str) -> int | None:
    """barvlDt 문자열 → 정수(초). 비어있거나 0 이하면 None."""
    try:
        v = int(s)
        return v if v > 0 else None
    except (ValueError, TypeError):
        return None


def _parse_arrive_seconds(barvlDt: str, arvlMsg3: str) -> int | None:
    """barvlDt 우선, 없으면 arvlMsg3의 'N분 후' 패턴 파싱."""
    v = _parse_seconds(barvlDt)
    if v:
        return v
    if arvlMsg3:
        m = _MIN_RE.search(arvlMsg3)
        if m:
            return int(m.group(1)) * 60
    return None


def _clean_bracket(msg: str) -> str:
    """[숫자]번째 전역 / [역명] 진입 등의 대괄호 정제."""
    if not msg:
        return ''
    m = _BRACKET_NUM_RE.match(msg)
    if m:
        return f"{m.group(1)}{m.group(2)}"
    m = _BRACKET_NM_RE.match(msg)
    if m:
        return f"{m.group(1)} {m.group(2).strip()}"
    return msg


def _extract_location_name(arvlMsg3: str) -> str:
    """arvlMsg3에서 역명만 추출.

    "12분 후 (광명사거리)" → "광명사거리"
    "[시흥시청] 진입" → "시흥시청"
    "종합운동장 도착" → "종합운동장"
    "" → ""
    """
    if not arvlMsg3:
        return ''
    # "N분 후 (역명)" 패턴
    paren = re.search(r'\(([^)]+)\)', arvlMsg3)
    if paren:
        return paren.group(1)
    # 대괄호 제거 및 상태 접미사 제거
    msg = arvlMsg3.replace('[', '').replace(']', '')
    loc = re.sub(r'\s*(도착|출발|진입|운행중|전역\s*\S+)\s*$', '', msg).strip()
    return loc if loc else ''


def _smart_status(arvl_cd: int, status_msg: str, location_msg: str) -> str:
    """arvlCd + 메시지를 조합해 가독성 좋은 한 줄 상태 문자열 반환.

    사용자에게 보이는 서브텍스트용.
    """
    cleaned_msg = _clean_bracket(status_msg)
    cleaned_loc = _clean_bracket(location_msg)
    loc_name = _extract_location_name(location_msg)

    if arvl_cd == 0:   # 진입 중 (이 역으로 들어오는 중)
        station = re.sub(r'\s*진입\s*$', '', cleaned_msg).strip()
        return f"{station} 진입 중" if station else "이 역 진입 중"
    if arvl_cd == 1:   # 도착
        station = re.sub(r'\s*도착\s*$', '', cleaned_msg).strip()
        return f"{station} 도착" if station else "도착"
    if arvl_cd == 2:   # 출발
        station = re.sub(r'\s*출발\s*$', '', cleaned_msg).strip()
        return f"{station} 출발" if station else "출발"
    if arvl_cd == 3:   # 전역 출발 (바로 전 역에서 출발)
        if loc_name:
            return f"{loc_name} 출발 → 곧 도착"
        return "전역 출발 → 곧 도착"
    if arvl_cd == 4:   # 전역 진입 (바로 전 역 진입 중)
        if loc_name:
            return f"{loc_name} 진입 중"
        return "전역 진입"
    if arvl_cd == 5:   # 전역 도착
        if loc_name:
            return f"{loc_name} 도착 → 곧 출발"
        return "전역 도착"
    # 99: 운행 중 — 위치 정보 중심
    if loc_name:
        m_min = _MIN_RE.search(location_msg)
        if m_min:
            return f"{loc_name} 출발 후 {m_min.group(1)}분"
        return cleaned_loc or cleaned_msg or '운행 중'
    return cleaned_msg or '운행 중'

def _extract_current_station(arvl_cd: int, status_msg: str, location_msg: str) -> str:
    """arvlCd 상태와 메시지를 기반으로 열차의 현재 위치(역명)를 반환한다."""
    # 1. location_msg (arvlMsg3) 우선 시도
    loc_name = _extract_location_name(location_msg)
    if loc_name:
        return loc_name
    
    # 2. status_msg (arvlMsg2) 시도 (예: "[정왕] 진입")
    status_loc = _extract_location_name(status_msg)
    if status_loc:
        return status_loc

    # 3. arvl_cd가 임박형(0, 1)인데 위에서 못찾은 경우, status_msg에서 더 공격적으로 파싱
    if arvl_cd in (0, 1) and status_msg:
        cleaned = _clean_bracket(status_msg)
        loc = re.sub(r'\s*(진입|도착)\s*$', '', cleaned).strip()
        if loc:
            return loc

    return ""


def parse_rows(rows: list[dict]) -> list[dict]:
    """raw row dict 목록을 파싱해 중복 제거 후 반환.

    같은 btrainNo에 여러 노선이 겹칠 경우, btrainNo의 번호 대역을 보고
    실제 소속 노선(4호선/수인분당선/서해선)을 판단합니다.
    """
    seen: dict[str, dict] = {}
    for row in rows:
        train_no = row.get("btrainNo", "")
        subway_id = row.get("subwayId", "1004")
        
        # 4호선 열차는 4xxx, 수인분당선은 6xxx, 서해선은 7xxx 대역을 주로 사용
        primary_subway_id = "1004"
        if train_no.startswith("6"):
            primary_subway_id = "1075"
        elif train_no.startswith("7"):
            primary_subway_id = "1093"

        if train_no not in seen:
            seen[train_no] = row
        # 이미 등록된 게 있어도, 이번 데이터가 더 정확한(주 노선과 일치하는) subwayId를 가지고 있다면 덮어씀
        elif subway_id == primary_subway_id:
            seen[train_no] = row

    result = []
    for train_no, row in seen.items():
        subway_id = row.get("subwayId", "1004")
        meta = _LINE_MAP.get(subway_id, _LINE_MAP["1004"])
        arvl_cd = int(row.get("arvlCd") or "99")
        status_msg_raw = row.get("arvlMsg2", "")
        location_msg_raw = row.get("arvlMsg3", "")
        arrive_seconds = _parse_arrive_seconds(row.get("barvlDt", ""), location_msg_raw)
        result.append({
            "line": meta["line"],
            "direction": row.get("updnLine", ""),
            "destination": row.get("bstatnNm", ""),
            "status_code": arvl_cd,
            # arvlMsg2: 짧은 상태 메시지 원본 ("전역 도착", "[역명] 진입" 등)
            "status_msg": status_msg_raw,
            # arvlMsg3: 위치/시간 메시지 원본
            "location_msg": location_msg_raw,
            # smart_status: 사람이 읽기 좋게 파싱한 상태 문자열
            "smart_status": _smart_status(arvl_cd, status_msg_raw, location_msg_raw),
            # current_station: 지도에서 기차 위치로 사용될 현재 역
            "current_station": _extract_current_station(arvl_cd, status_msg_raw, location_msg_raw),
            # barvlDt: 도착 예정까지 남은 초 (없으면 null)
            "arrive_seconds": arrive_seconds,
            # recptnDt: 열차도착정보를 생성한 시각 (예: "2026-04-22 18:05:32")
            "recptn_dt": row.get("recptnDt", ""),
            # lstcarAt: 막차 여부
            "is_last_train": row.get("lstcarAt", "0") == "1",
            "train_type": row.get("btrainSttus", ""),
            "train_no": train_no,
            "color": meta["color"],
            "ordkey": row.get("ordkey", ""),
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
