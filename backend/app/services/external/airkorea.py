"""에어코리아(한국환경공단) 대기오염정보 어댑터 — F5 이동 지수의 전제.

data.go.kr '한국환경공단_에어코리아_대기오염정보'의 측정소별 실시간 측정
(getMsrstnAcctoRltmMesureDnsty)을 사용한다. 측정소는 학교와 같은 동네인
'정왕동' 고정. 서비스 키는 기상청과 같은 DATA_GO_KR_SERVICE_KEY를 쓴다 —
단, 계정에서 이 API의 활용신청이 승인돼 있어야 한다(미승인이면 'Forbidden'
텍스트 응답 → None 반환으로 조용히 저하되고, 승인되는 순간부터 자동 동작).
"""

import logging

from app.core.config import settings
from app.core.http_client import get_http_client

logger = logging.getLogger(__name__)

_BASE = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"
_STATION = "정왕동"

# 에어코리아 grade 코드 → 한글 라벨 (1~4)
_GRADE_LABEL = {"1": "좋음", "2": "보통", "3": "나쁨", "4": "매우나쁨"}


def _to_int(value) -> int | None:
    """측정값 문자열 → int. 통신장애 시 '-' 가 온다."""
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def parse_air_response(payload: dict) -> dict | None:
    """API JSON → {"pm10", "pm25", "pm10_grade", "pm25_grade"} | None."""
    try:
        items = payload["response"]["body"]["items"]
    except (KeyError, TypeError):
        return None
    if not items:
        return None
    item = items[0]
    return {
        "pm10": _to_int(item.get("pm10Value")),
        "pm25": _to_int(item.get("pm25Value")),
        "pm10_grade": _GRADE_LABEL.get(str(item.get("pm10Grade1h") or item.get("pm10Grade") or "")),
        "pm25_grade": _GRADE_LABEL.get(str(item.get("pm25Grade1h") or item.get("pm25Grade") or "")),
    }


async def fetch_air_quality() -> dict | None:
    """정왕동 측정소 실시간 미세먼지. 실패·미승인 시 None (호출부가 저하 처리)."""
    client = await get_http_client()
    try:
        resp = await client.get(
            _BASE,
            params={
                "serviceKey": settings.DATA_GO_KR_SERVICE_KEY,
                "returnType": "json",
                "numOfRows": 1,
                "pageNo": 1,
                "stationName": _STATION,
                "dataTerm": "DAILY",
                "ver": "1.3",
            },
        )
        resp.raise_for_status()
        # 활용신청 미승인이면 JSON이 아니라 'Forbidden' 텍스트가 온다
        if "json" not in (resp.headers.get("content-type") or "") and not resp.text.startswith("{"):
            logger.warning("에어코리아 응답이 JSON이 아님(활용신청 미승인 가능): %.40s", resp.text)
            return None
        return parse_air_response(resp.json())
    except Exception:
        logger.exception("에어코리아 조회 실패")
        return None
