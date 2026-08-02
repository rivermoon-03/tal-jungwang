"""안드로이드 홈 위젯 전용 경량 엔드포인트 (교통·학식·학사일정 3종).

위젯은 Kotlin에서 org.json으로 파싱하고 TextView에 그대로 꽂는다. 그래서
가공은 전부 서버에서 끝내고(라벨·값·부제 문자열), 클라이언트는 렌더링만 한다:
  - 파싱 코드가 얇아야 위젯이 안 깨진다(위젯은 크래시해도 사용자가 원인을 못 본다)
  - 표기 규칙(분 반올림·막차 표시·끼니 선택)이 앱과 위젯에서 갈라지지 않는다

type 파라미터로 세 위젯이 같은 엔드포인트를 공유한다:
  transit(기본) — mode=bus|shuttle|subway 로 전환. 위젯 하단 칩이 이 값을 바꾼다.
  cafeteria     — 시각에 맞는 끼니의 대표 메뉴
  calendar      — 다가오는 학사일정 D-day
"""

import asyncio
import logging
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.common import ApiResponse
from app.schemas.widget import WidgetResponse
from app.services.bus import get_arrivals
from app.services.cafeteria import get_menu
from app.services.school import get_calendar
from app.services.shuttle import get_next as shuttle_get_next
from app.services.shuttle import get_schedule as shuttle_get_schedule
from app.services.subway import get_next as subway_get_next

logger = logging.getLogger(__name__)
KST = ZoneInfo("Asia/Seoul")

router = APIRouter(prefix="/api/v1/widget", tags=["widget"])

_DEFAULT_BUS_STATION_ID = 3  # 한국공학대학교

# 지하철 위젯에 싣는 방향 — 정왕역 수인분당(상·하행) + 4호선 상행.
_SUBWAY_ROWS = [
    ("up", "수", "상행"),
    ("line4_down", "4", "하행"),
    ("line4_up", "4", "상행"),
]

# 셔틀 위젯 행: (direction, 배지, 라벨)
_SHUTTLE_ROWS = [
    (0, "등", "정왕역 → 학교"),
    (1, "하", "학교 → 정왕역"),
    (2, "2캠", "본교 → 제2캠"),
]


# ── 공통 포맷터 ────────────────────────────────────────────────────────


def _minutes_text(seconds: int | None) -> str | None:
    """초 → 위젯 표기. 1시간 넘어가면 분 대신 시간으로 접는다(칸이 좁다)."""
    if seconds is None:
        return None
    if seconds < 60:
        return "곧"
    minutes = round(seconds / 60)
    if minutes >= 60:
        return f"{minutes // 60}시간"
    return f"{max(1, minutes)}분"


def _row(kind: str, badge: str, label: str, value: str, sub: str = "") -> dict:
    return {"kind": kind, "badge": badge, "label": label, "value": value, "sub": sub}


# ── 교통 ───────────────────────────────────────────────────────────────


def _bus_rows(result: Any) -> list[dict]:
    arrivals = result.get("arrivals") if isinstance(result, dict) else None
    rows: list[dict] = []
    for a in arrivals or []:
        sec = a.get("arrive_in_seconds")
        if sec is None or a.get("is_tomorrow"):
            continue
        route = a.get("route_no") or "버스"
        rows.append(
            _row(
                "bus",
                route[:3],  # 배지는 좁다 — 앞 3글자만
                route,
                _minutes_text(sec) or "-",
                a.get("destination") or "",
            )
        )
        if len(rows) == 3:
            break
    return rows


def _shuttle_rows(results: list[Any], schedule: Any) -> list[dict]:
    period = schedule.get("schedule_name") if isinstance(schedule, dict) else None
    rows: list[dict] = []
    for (_, badge, label), res in zip(_SHUTTLE_ROWS, results, strict=True):
        if not isinstance(res, dict) or not res.get("depart_at"):
            continue
        depart = res["depart_at"][:5]
        sub = f"{depart} 출발"
        if res.get("is_last"):
            sub = f"{sub} · 막차"
        rows.append(_row("shuttle", badge, label, _minutes_text(res.get("arrive_in_seconds")) or depart, sub))
    if rows and period:
        rows[0]["period"] = period  # 헤더에 기간명을 얹기 위한 힌트
    return rows


def _subway_rows(result: Any) -> list[dict]:
    if not isinstance(result, dict):
        return []
    rows: list[dict] = []
    for key, badge, direction_label in _SUBWAY_ROWS:
        train = result.get(key)
        if not train:
            continue
        sub = direction_label
        if train.get("last_depart_at"):
            sub = f"{sub} · 막차 {train['last_depart_at']}"
        rows.append(
            _row(
                "subway",
                badge,
                f"{train.get('destination', '')} 방면".strip(),
                _minutes_text(train.get("arrive_in_seconds")) or "-",
                sub,
            )
        )
        if len(rows) == 3:
            break
    return rows


async def _transit_payload(db: AsyncSession, mode: str, station_id: int, now: datetime) -> dict:
    d, t = now.date(), now.time()

    if mode == "shuttle":
        tasks = [shuttle_get_next(db, d, t, dir_) for dir_, _, _ in _SHUTTLE_ROWS]
        tasks.append(shuttle_get_schedule(db, d))
        results = await asyncio.gather(*tasks, return_exceptions=True)
        rows = _shuttle_rows(list(results[:-1]), results[-1])
        period = rows[0].pop("period", None) if rows else None
        title = f"셔틀버스 · {period}" if period else "셔틀버스"
        empty = "지금은 운행하는 셔틀이 없어요"
    elif mode == "subway":
        result = await _safe(subway_get_next(db, d, t), "subway")
        rows = _subway_rows(result)
        title = "정왕역"
        empty = "지금은 도착 정보가 없어요"
    else:  # bus
        result = await _safe(get_arrivals(db, station_id, d, t), "bus")
        rows = _bus_rows(result)
        title = (result or {}).get("station_name", "버스") if isinstance(result, dict) else "버스"
        empty = "지금은 도착 정보가 없어요"

    return {"title": title, "items": rows, "empty_text": None if rows else empty}


async def _safe(coro, name: str):
    """한 소스가 죽어도 위젯 전체가 비지 않게 예외를 흡수한다."""
    try:
        return await coro
    except Exception:
        logger.warning("widget: %s 조회 실패", name, exc_info=True)
        return None


# ── 학식 ───────────────────────────────────────────────────────────────

# 시각 → 끼니. 경계는 학식 운영시간(조 09~10 / 중 11~14 / 석 17~18:50) 기준.
def _current_meal(now: datetime) -> str:
    hour = now.hour
    if hour < 10:
        return "조식"
    if hour < 14:
        return "중식"
    return "석식"


def _cafeteria_payload(menu: Any, now: datetime) -> dict:
    meal_type = _current_meal(now)
    # 크롤 실패·주말 등으로 cafeterias가 아예 비어 올 수 있다(빈 리스트 인덱싱 금지).
    cafeterias = (menu or {}).get("cafeterias") or [] if isinstance(menu, dict) else []
    cafeteria = cafeterias[0] if cafeterias else {}
    meals = cafeteria.get("meals") or []
    day_key = str(now.day)

    meal = next((m for m in meals if meal_type in (m.get("type") or "")), None)
    items = [i for i in ((meal or {}).get("by_day", {}).get(day_key) or []) if i]

    if not items:
        return {
            "title": "학식",
            "meal": meal_type,
            "items": [],
            "empty_text": "오늘은 등록된 식단이 없어요",
        }

    # 메인 2개는 굵게, 나머지는 한 줄로 접는다(2×2 칸에 맞추기 위한 규칙 — 시안과 동일).
    rows = [_row("menu", "", name, "") for name in items[:2]]
    if len(items) > 2:
        rows.append(_row("menu_more", "", " · ".join(items[2:]), ""))
    return {
        "title": cafeteria.get("name") or "TIP 학생식당",
        "meal": meal_type,
        "items": rows,
        "empty_text": None,
        "sub": (meal or {}).get("time") or "",
    }


# ── 학사일정 ───────────────────────────────────────────────────────────


def _dday_text(start: str, today: date) -> str:
    y, m, d = (int(x) for x in start.split("-"))
    diff = (date(y, m, d) - today).days
    if diff < 0:
        return "진행 중"
    return "D-DAY" if diff == 0 else f"D-{diff}"


def _md(value: str | None) -> str:
    if not value:
        return ""
    parts = value.split("-")
    return f"{int(parts[1])}/{int(parts[2])}" if len(parts) == 3 else value


def _calendar_payload(calendar: Any, today: date) -> dict:
    events = []
    if isinstance(calendar, dict):
        events = [e for e in [calendar.get("next"), *(calendar.get("upcoming") or [])] if e]

    rows = [
        _row(
            "calendar",
            _dday_text(ev["start_date"], today),
            ev.get("title", ""),
            "",
            f"{_md(ev.get('start_date'))} ~ {_md(ev.get('end_date') or ev.get('start_date'))}",
        )
        for ev in events[:3]
    ]
    return {
        "title": "학사일정",
        "items": rows,
        "empty_text": None if rows else "다가오는 일정이 없어요",
    }


# ── 라우트 ─────────────────────────────────────────────────────────────


@router.get("")
@limiter.limit("60/minute")
async def widget_summary(
    request: Request,
    response: Response,
    type: str = Query("transit", pattern="^(transit|cafeteria|calendar)$"),
    mode: str = Query("bus", pattern="^(bus|shuttle|subway)$", description="transit 전용"),
    station_id: int = Query(_DEFAULT_BUS_STATION_ID),
    db: AsyncSession = Depends(get_db),
):
    """위젯 한 화면(최대 3줄)에 필요한 문자열만 반환한다."""
    now = datetime.now(KST)

    if type == "cafeteria":
        # get_menu는 DB를 쓰지 않는다(외부 크롤 + Redis cache-aside)
        payload = _cafeteria_payload(await _safe(get_menu(), "cafeteria"), now)
    elif type == "calendar":
        payload = _calendar_payload(await _safe(get_calendar(db), "calendar"), now.date())
    else:
        payload = await _transit_payload(db, mode, station_id, now)

    payload["updated_at"] = now.strftime("%H:%M")
    payload["type"] = type
    payload.setdefault("mode", mode if type == "transit" else "")

    # 위젯은 30분 주기 갱신이라 짧은 캐시로 충분하다(동시 요청 폭주 완충).
    response.headers["Cache-Control"] = "public, max-age=20, stale-while-revalidate=60"
    return ApiResponse[WidgetResponse].ok(payload)
