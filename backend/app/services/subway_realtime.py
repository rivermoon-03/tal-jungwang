"""서울 지하철 실시간 도착정보 서비스 (정왕·시흥시청·초지).

API 한도: 서울시 운영계정으로 한도 없음
폴링 전략: 피크(07~09, 17~19) 15초 / 비피크 20초 / 심야(00:00~03:49) 10분, 24시간 체크
캐시 키: subway:realtime:{역명}  TTL: 30초 (심야엔 폴링 주기가 길어 720초)

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

import asyncio
import json
import logging
import re
import statistics
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from datetime import time as dtime
from zoneinfo import ZoneInfo

import httpx

from app.core.cache import get_cached_json, get_redis, set_cached_json
from app.core.calendar import get_day_type
from app.core.config import settings

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")

_BASE_URL = "http://swopenAPI.seoul.go.kr/api/subway/{key}/xml/realtimeStationArrival/0/20/{station}"
_CACHE_TTL = 30
# 심야엔 폴링 주기가 10분이라 30초 TTL이면 폴링 사이에 캐시가 비어 요청마다 외부 호출이 터진다.
# 폴링 간격(600초)보다 길게 잡아 폴링이 채운 값을 다음 폴링까지 유지한다.
_LATE_NIGHT_CACHE_TTL = 720
# 직전 성공 응답을 5분 동안 보관해 graceful degradation에 사용한다.
# (실시간 API가 빈 배열을 반환하거나 일시적으로 실패해도, 5분 이내라면 이 값을 stale 플래그와 함께 반환)
_LAST_SUCCESS_TTL = 300

_LINE_MAP = {
    "1004": {"line": "4호선",     "color": "#1B5FAD"},
    "1075": {"line": "수인분당선", "color": "#F5A623"},
    "1093": {"line": "서해선",    "color": "#75bf43"},
}

# 지원하는 역 목록 (API URL용 역명)
STATIONS = ["정왕", "시흥시청", "초지"]

# 노선 우선순위 (같은 열차번호에 여러 노선이 있을 때)
_LINE_PRIORITY = {"1075": 0, "1093": 1, "1004": 2}

# ── A5·A6: 도착 이력 적재 + 자체 지연 감지 상수 ─────────────────────────────
# 노선명 → subwayId 역매핑 (이력 적재·지연 키에 사용)
_NAME_TO_LINE_ID = {meta["line"]: line_id for line_id, meta in _LINE_MAP.items()}

# 같은 (역, 열차번호) 중복 적재 방지 — bus_collector 의 `bus:counted:*` 패턴.
_COUNTED_TTL = 1800          # 30분
# 직전 폴링 스냅샷(ETA 소실 판정용). 폴링 간격 15~20초 대비 여유 TTL.
_PREV_TTL = 300
# 스냅샷이 이보다 오래됐으면 ETA 소실 판정을 건너뛴다 — 심야(10분 주기) 등
# 폴링 공백이 길면 "사라진 시점"을 특정할 수 없어 도착 시각이 크게 어긋난다.
_PREV_MAX_AGE_SEC = 120
# 직전 폴링에서 이 값 이하로 임박했던 열차가 사라지면 도착으로 판정.
_ETA_LOST_THRESHOLD_SEC = 180

# 편차 계산: 같은 역/노선/방향 시간표에서 ±20분 내 가장 가까운 계획 시각과 비교.
_DEVIATION_WINDOW_MIN = 20
_DEVIATION_LIST_MAX = 5      # 최근 5건 유지
_DEVIATION_TTL = 2400        # 40분
# 지연 판정: 최근 3건 이상의 중앙값이 +5분 이상.
_DELAY_MIN_SAMPLES = 3
_DELAY_THRESHOLD_MIN = 5.0
_DELAY_TTL = 720             # 12분 — 갱신 시 연장, 해소되면 TTL로 자연 소멸

# 실시간 API 방향(상행/하행) → Redis 키용 축약
_UPDN_TO_DIR = {"상행": "up", "하행": "down"}

# (역, 노선ID, 상행/하행) → subway_timetable_entries.direction 키.
# 시간표는 역·노선·방향이 direction 문자열 하나에 합쳐져 있다 (subway.py 참고).
_TIMETABLE_DIR_MAP = {
    ("정왕", "1075", "상행"): "up",
    ("정왕", "1075", "하행"): "down",
    ("정왕", "1004", "상행"): "line4_up",
    ("정왕", "1004", "하행"): "line4_down",
    ("시흥시청", "1093", "상행"): "siheung_up",
    ("시흥시청", "1093", "하행"): "siheung_dn",
    ("초지", "1093", "상행"): "choji_up",
    ("초지", "1093", "하행"): "choji_dn",
}


def _cache_ttl_for_now() -> int:
    """현재 시각대에 맞는 실시간 캐시 TTL. 심야엔 폴링 주기가 길어 캐시가 비지 않도록 늘린다."""
    now = datetime.now(_KST)
    is_late_night = (1 <= now.hour < 3) or (now.hour == 3 and now.minute < 50)
    return _LATE_NIGHT_CACHE_TTL if is_late_night else _CACHE_TTL


def _cache_key(station: str) -> str:
    return f"subway:realtime:{station}"


def _last_fetch_key(station: str) -> str:
    return f"subway:realtime:last_fetch:{station}"


def _last_success_key(station: str) -> str:
    """직전 성공 응답을 보관하는 키. {items, fetched_at_iso} 형식.

    `_cache_key`(30초 TTL)와 분리해서, 빈 응답·실패가 와도 5분간 stale fallback으로 사용한다.
    """
    return f"subway:realtime:last_success:{station}"


def _prev_key(station: str) -> str:
    """직전 폴링 스냅샷 키 — ETA 소실 기반 도착 판정용."""
    return f"subway:prev:{station}"


def _counted_key(station: str, train_no: str) -> str:
    """같은 (역, 열차번호) 중복 적재 방지 키 (TTL 30분)."""
    return f"subway:counted:{station}:{train_no}"


def _deviation_key(station: str, line_id: str, dir_key: str) -> str:
    """편차(분) 최근 N건 Redis 리스트 키. dir_key 는 up|down."""
    return f"subway:deviation:{station}:{line_id}:{dir_key}"


def _delay_key(station: str, line_id: str, dir_key: str) -> str:
    """지연 감지 상태 키 — {minutes, since, recent}. dir_key 는 up|down."""
    return f"subway:delay:{station}:{line_id}:{dir_key}"


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

    # recptn_dt와 현재 시각의 차이만큼 arrive_seconds를 보정한다.
    # Seoul API는 recptn_dt 기준으로 barvlDt를 산출하므로,
    # 데이터가 오래됐을수록 카운트다운 기준이 실제보다 앞서게 된다.
    now_kst = datetime.now(_KST)
    for item in parsed:
        if not item.get("arrive_seconds") or not item.get("recptn_dt"):
            continue
        try:
            recptn = datetime.strptime(item["recptn_dt"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=_KST)
            age = int((now_kst - recptn).total_seconds())
            if 0 < age < 3600:
                item["arrive_seconds"] = max(0, item["arrive_seconds"] - age)
        except (ValueError, TypeError):
            pass

    logger.debug("지하철 실시간 fetch: %s → %d건", station, len(parsed))
    return parsed


async def _store_last_success(station: str, data: list[dict]) -> None:
    """실시간 API가 비어있지 않은 응답을 줬을 때만 last_success에 저장한다.

    빈 배열을 last_success로 저장하면 graceful degradation이 의미가 없으므로
    의도적으로 비어있지 않을 때만 갱신한다.
    """
    if not data:
        return
    payload = {
        "items": data,
        "fetched_at_iso": datetime.now(_KST).isoformat(timespec="seconds"),
    }
    await set_cached_json(_last_success_key(station), payload, ttl=_LAST_SUCCESS_TTL)


async def _read_last_success(station: str) -> dict | None:
    """last_success 캐시를 읽어 {items, fetched_at_iso} 또는 None을 반환."""
    raw = await get_cached_json(_last_success_key(station))
    if not raw or not isinstance(raw, dict):
        return None
    items = raw.get("items")
    fetched_at = raw.get("fetched_at_iso")
    if not items or not fetched_at:
        return None
    return {"items": items, "fetched_at_iso": fetched_at}


# ── A5: 도착 판정 · 이력 적재 ────────────────────────────────────────────────


def _build_prev_snapshot(items: list[dict], now_ts: float) -> dict:
    """다음 폴링에서 ETA 소실 판정에 쓸 스냅샷. {fetched_at, trains:{train_no: …}}"""
    trains: dict[str, dict] = {}
    for it in items:
        train_no = it.get("train_no")
        if not train_no:
            continue
        trains[train_no] = {
            "line": it.get("line", ""),
            "direction": it.get("direction", ""),
            "destination": it.get("destination", ""),
            "arrive_seconds": it.get("arrive_seconds"),
            "status_code": it.get("status_code"),
        }
    return {"fetched_at": now_ts, "trains": trains}


def detect_arrivals(
    prev_snapshot: dict | None, items: list[dict], now_ts: float
) -> list[dict]:
    """도착 이벤트 판정 (순수 함수 — Redis/DB 접근 없음).

    두 경로로 도착을 판정한다:
      1) 이번 폴링에서 arvlCd=1(도착)인 열차.
      2) 직전 스냅샷에 임박 상태(진입/도착 또는 잔여 ≤ _ETA_LOST_THRESHOLD_SEC초)로
         있었는데 이번 폴링에서 사라진 열차 (ETA 소실).
    스냅샷이 _PREV_MAX_AGE_SEC 보다 오래됐으면 2)는 건너뛴다 — 심야 등 폴링
    공백이 길면 도착 시각 특정이 불가능해 이력 품질이 나빠진다.

    Returns: [{train_no, line, direction, destination}]
    """
    events: dict[str, dict] = {}
    current_nos: set[str] = set()

    for it in items:
        train_no = it.get("train_no")
        if not train_no:
            continue
        current_nos.add(train_no)
        if it.get("status_code") == 1:
            events[train_no] = {
                "train_no": train_no,
                "line": it.get("line", ""),
                "direction": it.get("direction", ""),
                "destination": it.get("destination", ""),
            }

    if isinstance(prev_snapshot, dict):
        fetched_at = prev_snapshot.get("fetched_at")
        trains = prev_snapshot.get("trains") or {}
        fresh_enough = (
            isinstance(fetched_at, (int, float))
            and now_ts - fetched_at <= _PREV_MAX_AGE_SEC
        )
        if fresh_enough and isinstance(trains, dict):
            for train_no, tr in trains.items():
                if train_no in current_nos or train_no in events:
                    continue
                sec = tr.get("arrive_seconds")
                imminent = tr.get("status_code") in (0, 1) or (
                    isinstance(sec, (int, float)) and sec <= _ETA_LOST_THRESHOLD_SEC
                )
                if imminent:
                    events[train_no] = {
                        "train_no": train_no,
                        "line": tr.get("line", ""),
                        "direction": tr.get("direction", ""),
                        "destination": tr.get("destination", ""),
                    }

    return list(events.values())


# ── A6: 시간표 편차 · 지연 감지 ──────────────────────────────────────────────


def nearest_deviation_minutes(
    arrived_at: datetime,
    departures: list[dtime],
    window_min: int = _DEVIATION_WINDOW_MIN,
) -> float | None:
    """실측 도착과 ±window_min 내 가장 가까운 계획 시각의 편차(분).

    양수 = 시간표보다 늦음. 자정 근처(23:55 계획 vs 00:05 도착)는 ±12시간
    normalize 로 wraparound 를 보정한다. window 밖이면 None.
    """
    if not departures:
        return None
    best: float | None = None
    for dep in departures:
        planned = datetime.combine(arrived_at.date(), dep, tzinfo=_KST)
        delta_min = (arrived_at - planned).total_seconds() / 60.0
        # 자정 wraparound — 예: 도착 00:05(오늘) vs 계획 23:55 → -1430분이 아니라 +10분.
        if delta_min > 720:
            delta_min -= 1440
        elif delta_min < -720:
            delta_min += 1440
        if best is None or abs(delta_min) < abs(best):
            best = delta_min
    if best is None or abs(best) > window_min:
        return None
    return round(best, 1)


def delay_minutes_from_samples(
    samples: list[float],
    min_samples: int = _DELAY_MIN_SAMPLES,
    threshold_min: float = _DELAY_THRESHOLD_MIN,
) -> int | None:
    """최근 편차 샘플의 중앙값이 +threshold_min 이상이면 반올림 분을 반환.

    샘플이 min_samples 미만이거나 중앙값이 기준 미만이면 None (지연 아님).
    중앙값을 쓰는 이유: 회차 지연·오검출 같은 이상치 1건이 판정을 뒤집지 않게.
    """
    if len(samples) < min_samples:
        return None
    med = statistics.median(samples)
    if med < threshold_min:
        return None
    return int(round(med))


async def _update_deviation_and_delay(
    db, redis, station: str, event: dict, arrived_at: datetime
) -> None:
    """도착 확정 1건에 대해 시간표 편차를 계산하고 지연 상태를 갱신한다."""
    line_id = _NAME_TO_LINE_ID.get(event.get("line", ""))
    dir_key = _UPDN_TO_DIR.get(event.get("direction", ""))
    if not line_id or not dir_key:
        return
    tt_dir = _TIMETABLE_DIR_MAP.get((station, line_id, event["direction"]))
    if not tt_dir:
        return

    # 시간표 로드는 subway.py 의 Redis 캐시(_load_entries)를 재사용한다.
    # day_type 도 시간표 조회와 동일한 quirk(토요일→sunday)를 태워야
    # 실제 서빙되는 시간표와 같은 기준으로 편차를 계산한다.
    from app.services.subway import _load_entries, _subway_day_type

    day = _subway_day_type(arrived_at.date())
    entries = await _load_entries(db, day)
    departures = [
        dtime.fromisoformat(e["departure_time"])
        for e in entries
        if e.get("direction") == tt_dir
    ]
    deviation = nearest_deviation_minutes(arrived_at, departures)
    if deviation is None:
        return

    dev_key = _deviation_key(station, line_id, dir_key)
    await redis.lpush(dev_key, json.dumps(deviation))
    await redis.ltrim(dev_key, 0, _DEVIATION_LIST_MAX - 1)
    await redis.expire(dev_key, _DEVIATION_TTL)

    raw_samples = await redis.lrange(dev_key, 0, -1)
    samples: list[float] = []
    for raw in raw_samples:
        try:
            samples.append(float(json.loads(raw)))
        except (ValueError, TypeError):
            continue

    minutes = delay_minutes_from_samples(samples)
    if minutes is None:
        # 지연 아님 — 기존 지연 키는 TTL(12분)로 자연 소멸시킨다.
        return

    d_key = _delay_key(station, line_id, dir_key)
    existing = await get_cached_json(d_key)
    since = (
        existing.get("since")
        if isinstance(existing, dict) and existing.get("since")
        else arrived_at.isoformat(timespec="seconds")
    )
    await set_cached_json(
        d_key,
        {"minutes": minutes, "since": since, "recent": samples},
        ttl=_DELAY_TTL,
    )
    logger.info(
        "지하철 지연 감지: %s %s %s → 약 +%d분 (샘플 %s)",
        station, event.get("line"), event.get("direction"), minutes, samples,
    )


async def _record_arrivals(station: str, items: list[dict]) -> None:
    """폴링 결과에서 도착을 판정해 이력을 적재하고 지연 상태를 갱신한다 (A5+A6).

    폴링당 도착 확정은 0~2건 수준이라, 도착이 없으면 DB 세션 자체를 열지 않는다.
    호출부(fetch_and_cache_realtime)가 예외를 격리하므로 여기서 터져도 폴링은 죽지 않는다.
    """
    redis = await get_redis()
    now = datetime.now(_KST)
    now_ts = time.time()

    prev_snapshot = await get_cached_json(_prev_key(station))
    events = detect_arrivals(prev_snapshot, items, now_ts)
    # 판정이 끝났으면 이번 폴링을 다음 판정의 기준 스냅샷으로 저장한다.
    await set_cached_json(_prev_key(station), _build_prev_snapshot(items, now_ts), ttl=_PREV_TTL)

    if not events:
        return

    # 같은 (역, 열차번호) 중복 방지 — SET NX 성공한 이벤트만 확정 (bus:counted:* 패턴).
    confirmed: list[dict] = []
    for ev in events:
        acquired = await redis.set(
            _counted_key(station, ev["train_no"]), "1", nx=True, ex=_COUNTED_TTL
        )
        if acquired:
            confirmed.append(ev)
    if not confirmed:
        return

    day_type = get_day_type(now.date())

    from app.core.database import AsyncSessionLocal
    from app.models.subway import SubwayArrivalHistory

    async with AsyncSessionLocal() as db:
        rows = 0
        for ev in confirmed:
            line_id = _NAME_TO_LINE_ID.get(ev.get("line", ""))
            if not line_id:
                continue
            db.add(SubwayArrivalHistory(
                station_name=station,
                line_id=line_id,
                direction=ev.get("direction", ""),
                train_no=ev["train_no"],
                arrived_at=now,
                day_type=day_type,
            ))
            rows += 1
        if rows:
            await db.commit()
            logger.info("지하철 도착 이력 적재: %s → %d건", station, rows)

        # 편차/지연 갱신은 이력 적재와 실패를 분리한다 — 한쪽이 죽어도 다른 쪽은 남긴다.
        for ev in confirmed:
            try:
                await _update_deviation_and_delay(db, redis, station, ev, now)
            except Exception:
                logger.exception(
                    "지하철 편차 계산 실패(이력은 적재됨): %s %s", station, ev.get("train_no")
                )


async def _read_delays(station: str) -> dict[tuple[str, str], dict]:
    """역의 방향별 지연 상태를 읽는다. {(노선명, 상행|하행): {minutes, since, recent}}"""
    combos = [
        (line_id, updn)
        for (stn, line_id, updn) in _TIMETABLE_DIR_MAP
        if stn == station
    ]
    if not combos:
        return {}
    redis = await get_redis()
    keys = [
        _delay_key(station, line_id, _UPDN_TO_DIR[updn]) for line_id, updn in combos
    ]
    raws = await redis.mget(keys)
    out: dict[tuple[str, str], dict] = {}
    for (line_id, updn), raw in zip(combos, raws):
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except (ValueError, TypeError):
            continue
        if not isinstance(payload, dict) or payload.get("minutes") is None:
            continue
        line_name = _LINE_MAP.get(line_id, {}).get("line", "")
        out[(line_name, updn)] = payload
    return out


def _attach_delays(items: list[dict], delays: dict[tuple[str, str], dict]) -> None:
    """지연 상태를 같은 노선·방향의 실시간 항목에 첨부한다 (있을 때만)."""
    if not delays:
        return
    for it in items:
        payload = delays.get((it.get("line", ""), it.get("direction", "")))
        if not payload:
            continue
        it["delay_minutes"] = payload.get("minutes")
        it["delay_since"] = payload.get("since")
        it["delay_samples"] = payload.get("recent") or []


async def _read_delays_safe(station: str) -> dict[tuple[str, str], dict]:
    """지연 조회 실패가 실시간 응답을 죽이지 않도록 감싼다."""
    try:
        return await _read_delays(station)
    except Exception as exc:
        logger.warning("지하철 지연 상태 조회 실패(무시): %s: %s", station, exc)
        return {}


async def get_realtime_cached(station: str) -> dict:
    """Redis 캐시 hit → 반환, miss → fetch.

    반환 형식 (graceful degradation 포함):
      {
        "items": list[dict],                # 실시간 항목 (없으면 [])
        "stale": bool,                      # last_success fallback 여부
        "last_successful_realtime_at": str | None,  # ISO8601 KST, 직전 성공 시각
      }
    """
    cached = await get_cached_json(_cache_key(station))
    if cached is None:
        try:
            cached = await fetch_realtime(station)
        except Exception:
            logger.exception("지하철 실시간 fetch 실패: %s", station)
            cached = []
        await set_cached_json(_cache_key(station), cached, ttl=_cache_ttl_for_now())
        redis = await get_redis()
        await redis.set(_last_fetch_key(station), str(time.time()), ex=300)
        if cached:
            await _store_last_success(station, cached)

    # 1) 현재 응답이 비어있지 않으면 그대로 사용 (fresh).
    if cached:
        last_success = await _read_last_success(station)
        # last_success가 없을 수도 있는 edge case (서버 시작 직후 첫 응답이 fresh로 들어오자마자
        # 호출된 경우)를 대비해 현재 시각으로 fallback.
        fetched_at_iso = (
            last_success["fetched_at_iso"]
            if last_success
            else datetime.now(_KST).isoformat(timespec="seconds")
        )
        # A6: 자체 감지한 지연을 방향별 항목에 첨부 (있을 때만 필드가 생긴다).
        _attach_delays(cached, await _read_delays_safe(station))
        return {
            "items": cached,
            "stale": False,
            "last_successful_realtime_at": fetched_at_iso,
        }

    # 2) 현재 응답이 비었으면 직전 5분 이내 성공값으로 graceful fallback.
    last_success = await _read_last_success(station)
    if last_success:
        _attach_delays(last_success["items"], await _read_delays_safe(station))
        return {
            "items": last_success["items"],
            "stale": True,
            "last_successful_realtime_at": last_success["fetched_at_iso"],
        }

    # 3) 5분 이상 성공값이 없으면 빈 응답.
    return {
        "items": [],
        "stale": False,
        "last_successful_realtime_at": None,
    }


async def fetch_and_cache_realtime(station: str) -> list[dict]:
    """스케줄러용: 강제 fetch 후 캐시 덮어쓰기.

    성공 시 last_success 키에도 5분 TTL로 저장한다.

    A5+A6: 폴링 경로에서만 도착 판정·이력 적재·지연 감지를 수행한다.
    요청 경로(get_realtime_cached 의 cache-aside fetch)에는 붙이지 않는다 —
    DISABLE_SCHEDULER=1 로 프로덕션 DB를 바라보는 read-only 인스턴스가
    요청을 받았을 때 중복 기록하는 것을 막기 위함. DB write 는 도착 확정
    시에만 발생한다 (폴링당 0~2건).
    """
    data = await fetch_realtime(station)
    await set_cached_json(_cache_key(station), data, ttl=_cache_ttl_for_now())
    redis = await get_redis()
    await redis.set(_last_fetch_key(station), str(time.time()), ex=300)
    if data:
        await _store_last_success(station, data)
    # 예외 격리 — 이력 적재/지연 감지가 죽어도 폴링(캐시 갱신)은 계속된다.
    try:
        await _record_arrivals(station, data)
    except Exception:
        logger.exception("지하철 도착 이력 적재 실패(폴링은 계속): %s", station)
    return data


async def get_all_realtime_cached() -> dict[str, dict]:
    """모든 역의 실시간 도착정보를 캐시에서 가져온다.

    반환 형식:
      {
        "<station>": {
          "items": [...],
          "stale": bool,
          "last_successful_realtime_at": str | None,
        },
        ...
      }
    역별로 asyncio.gather 병렬 처리 — 한 역이 실패해도 나머지 역은 정상 반환.
    """
    coros = [get_realtime_cached(station) for station in STATIONS]
    settled = await asyncio.gather(*coros, return_exceptions=True)
    results: dict[str, dict] = {}
    for station, res in zip(STATIONS, settled):
        if isinstance(res, Exception):
            logger.exception(
                "지하철 실시간 캐시 조회 실패: %s", station, exc_info=res
            )
            results[station] = {
                "items": [],
                "stale": False,
                "last_successful_realtime_at": None,
            }
        else:
            results[station] = res
    return results
