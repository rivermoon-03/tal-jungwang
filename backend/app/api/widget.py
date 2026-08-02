"""안드로이드 홈 위젯 전용 경량 엔드포인트.

위젯은 Kotlin에서 org.json으로 파싱하고 TextView에 그대로 꽂는다. 그래서
가공은 전부 서버에서 끝내고(라벨·값·부제 문자열), 클라이언트는 렌더링만 한다:
  - 파싱 코드가 얇아야 위젯이 안 깨진다(위젯은 크래시해도 사용자가 원인을 못 본다)
  - 표기 규칙(분 반올림·막차 표시)이 앱과 위젯에서 갈라지지 않는다

/dashboard 와 같은 서비스 함수를 쓰지만 응답은 3줄로 압축한다.
"""

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.widget import WidgetResponse
from app.services.bus import get_arrivals
from app.services.shuttle import get_next as shuttle_get_next
from app.services.subway import get_next as subway_get_next

logger = logging.getLogger(__name__)
KST = ZoneInfo("Asia/Seoul")

router = APIRouter(prefix="/api/v1/widget", tags=["widget"])

_DEFAULT_BUS_STATION_ID = 3  # 한국공학대학교

# 위젯 한 줄로 보여줄 지하철 방향(정왕역 상행=서울 방면). 위젯은 좁아서 한 줄만 쓴다.
_SUBWAY_DIRECTION = "up"


def _minutes_text(seconds: int | None) -> str | None:
    if seconds is None:
        return None
    if seconds < 60:
        return "곧"
    return f"{max(1, round(seconds / 60))}분"


def _shuttle_row(result, direction_label: str) -> dict | None:
    if not isinstance(result, dict) or not result.get("depart_at"):
        return None
    value = _minutes_text(result.get("arrive_in_seconds")) or result["depart_at"][:5]
    sub = result["depart_at"][:5]
    if result.get("is_last"):
        sub = f"{sub} · 막차"
    return {"kind": "shuttle", "label": f"셔틀 {direction_label}", "value": value, "sub": sub}


def _bus_row(result) -> dict | None:
    arrivals = (result or {}).get("arrivals") if isinstance(result, dict) else None
    if not arrivals:
        return None
    for a in arrivals:
        sec = a.get("arrive_in_seconds")
        if sec is None or a.get("is_tomorrow"):
            continue
        return {
            "kind": "bus",
            "label": a.get("route_no") or "버스",
            "value": _minutes_text(sec) or "-",
            "sub": a.get("destination") or "",
        }
    return None


def _subway_row(result) -> dict | None:
    if not isinstance(result, dict):
        return None
    train = result.get(_SUBWAY_DIRECTION)
    if not train:
        return None
    return {
        "kind": "subway",
        "label": "정왕역",
        "value": _minutes_text(train.get("arrive_in_seconds")) or "-",
        "sub": f"{train.get('destination', '')} 방면".strip(),
    }


@router.get("")
@limiter.limit("60/minute")
async def widget_summary(
    request: Request,
    response: Response,
    direction: int = Query(0, ge=0, le=3, description="셔틀 방향 0=등교 1=하교"),
    station_id: int = Query(_DEFAULT_BUS_STATION_ID),
    db: AsyncSession = Depends(get_db),
):
    """위젯 한 화면(최대 3줄)에 필요한 문자열만 반환한다.

    한 소스가 실패해도 나머지 줄은 그대로 보낸다 — 위젯이 통째로 비는 것보다
    두 줄이라도 뜨는 편이 낫다.
    """
    now = datetime.now(KST)
    d, t = now.date(), now.time()

    shuttle_result, bus_result, subway_result = await asyncio.gather(
        shuttle_get_next(db, d, t, direction),
        get_arrivals(db, station_id, d, t),
        subway_get_next(db, d, t),
        return_exceptions=True,
    )
    for name, res in (("shuttle", shuttle_result), ("bus", bus_result), ("subway", subway_result)):
        if isinstance(res, Exception):
            logger.warning("widget: %s 조회 실패: %s", name, res)

    direction_label = "등교" if direction in (0, 2) else "하교"
    rows = [
        _shuttle_row(shuttle_result, direction_label),
        _bus_row(bus_result),
        _subway_row(subway_result),
    ]
    items = [r for r in rows if r]

    # 위젯은 30분 주기 갱신이라 짧은 캐시로 충분하다(동시 요청 폭주 완충).
    response.headers["Cache-Control"] = "public, max-age=20, stale-while-revalidate=60"
    return ApiResponse[WidgetResponse].ok(
        {
            "updated_at": now.strftime("%H:%M"),
            "direction": direction_label,
            "items": items,
            "empty_text": None if items else "지금은 운행 정보가 없어요",
        }
    )
