"""국토부 ITS(국가교통정보센터) 돌발상황정보 어댑터 — B3 통학축 돌발 배너의 전제.

국가교통정보센터 오픈API(openapi.its.go.kr eventInfo)를 쓴다.

**키 체계가 data.go.kr 과 다르다.** its.go.kr/opendata 에서 따로 발급받아
`ITS_API_KEY` 로 넣어야 한다 — 2026-08-03 실측으로 DATA_GO_KR_SERVICE_KEY 를
그대로 보내면 `resultCode 4005 존재하지 않는 인증키` 가 돌아옴을 확인했다.
공유 키(기상청·GBIS·에어코리아)에 ITS 키를 덮어쓰면 그쪽이 전부 죽으므로
반드시 별도 변수를 쓴다.

키가 없거나 오류면 None 을 돌려 호출부가 빈 목록으로 저하시키고(배너 미표시),
키가 채워지는 순간부터 자동 동작한다 — airkorea.py 와 같은 패턴.
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.core.http_client import get_http_client

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")

_BASE = "https://openapi.its.go.kr:9443/eventInfo"

# 통학축 bbox — 시흥 정왕동(학교 126.7335/37.3403, 정왕역 126.7427/37.3516)에서
# 서울 방면 광역버스(3400·5200·6502·3401)가 타는 서해안로 축(월곶JC~북단 분기
# ~126.88/37.47)을 덮는다. 이 밖의 돌발은 통학 지연 신호가 아니라서 버린다.
BBOX_LON_MIN, BBOX_LON_MAX = 126.68, 126.88
BBOX_LAT_MIN, BBOX_LAT_MAX = 37.32, 37.47


def _normalize_type(event_type) -> str | None:
    """ITS eventType(한글 분류) → 서비스 type. 사고·공사만 쓴다(기상·행사 등 제외)."""
    text = str(event_type or "")
    if "사고" in text:
        return "accident"
    if "공사" in text:
        return "construction"
    return None


def _to_float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_occurred_at(value) -> str | None:
    """ITS startDate('yyyyMMddHHmmss') → KST tz-aware ISO 문자열. 실패 시 None."""
    try:
        return datetime.strptime(str(value), "%Y%m%d%H%M%S").replace(tzinfo=_KST).isoformat()
    except (TypeError, ValueError):
        return None


def parse_incident_response(payload: dict) -> list[dict]:
    """API JSON → [{"type", "road_name", "message", "occurred_at"}].

    요청 파라미터로도 bbox를 보내지만, 공공 API가 범위 필터를 무시하는 사례가
    있어 응답 좌표(coordX/coordY)로 한 번 더 거른다. 좌표가 없으면 통학축 위인지
    확인할 수 없으므로 버린다(과소 표시가 오탐 배너보다 낫다).
    """
    try:
        items = payload["body"]["items"]
    except (KeyError, TypeError):
        return []
    if not isinstance(items, list):
        return []

    incidents: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        incident_type = _normalize_type(item.get("eventType"))
        if incident_type is None:
            continue
        lon = _to_float(item.get("coordX"))
        lat = _to_float(item.get("coordY"))
        if lon is None or lat is None:
            continue
        if not (BBOX_LON_MIN <= lon <= BBOX_LON_MAX and BBOX_LAT_MIN <= lat <= BBOX_LAT_MAX):
            continue
        incidents.append({
            "type": incident_type,
            "road_name": str(item.get("roadName") or "").strip(),
            "message": str(item.get("message") or "").strip(),
            "occurred_at": _parse_occurred_at(item.get("startDate")),
        })
    return incidents


def result_code_ok(payload) -> bool:
    """ITS 응답 header.resultCode 가 정상인지.

    키가 틀리면 HTTP 200 + JSON 으로 `{"header":{"resultCode":4005,...},"body":""}` 가
    온다. 이걸 안 보면 body 파싱이 그냥 빈 목록이 되어 "돌발 없음"과 구분되지 않는다
    — 기상청 어댑터가 resultCode 를 따로 보는 이유와 같다(kma.py LAST_ERROR 주석).
    """
    if not isinstance(payload, dict):
        return False
    header = payload.get("header")
    if not isinstance(header, dict):
        return True  # 헤더가 없는 응답 형태면 body 파싱에 맡긴다
    code = str(header.get("resultCode", "0")).strip()
    if code in ("0", "00", "000"):
        return True
    logger.warning(
        "ITS 응답 오류 resultCode=%s msg=%s", code, header.get("resultMsg"),
    )
    return False


async def fetch_incidents() -> list[dict] | None:
    """통학축 bbox 안의 돌발상황(사고·공사). 실패·미승인 시 None (호출부가 저하 처리)."""
    if not settings.ITS_API_KEY:
        # 키 미설정은 정상 상태다(기능 미활성) — 매 요청 예외 로그를 남기지 않는다.
        return None
    client = await get_http_client()
    try:
        resp = await client.get(
            _BASE,
            params={
                "apiKey": settings.ITS_API_KEY,
                "type": "all",        # 고속도로+국도+지방도 전부 (서해안로 축은 혼재)
                "eventType": "all",   # 응답에서 사고·공사만 걸러낸다
                "getType": "json",
                "minX": BBOX_LON_MIN,
                "maxX": BBOX_LON_MAX,
                "minY": BBOX_LAT_MIN,
                "maxY": BBOX_LAT_MAX,
            },
        )
        resp.raise_for_status()
        # 활용신청 미승인이면 JSON이 아니라 'Forbidden'류 텍스트가 온다
        if "json" not in (resp.headers.get("content-type") or "") and not resp.text.startswith("{"):
            logger.warning("ITS 응답이 JSON이 아님(활용신청 미승인 가능): %.40s", resp.text)
            return None
        payload = resp.json()
        if not result_code_ok(payload):
            return None
        return parse_incident_response(payload)
    except Exception:
        logger.exception("ITS 돌발상황 조회 실패")
        return None
