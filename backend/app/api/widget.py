"""안드로이드 홈 위젯 전용 경량 엔드포인트 (교통·학식·학사일정 3종).

위젯은 Kotlin에서 org.json으로 파싱하고 TextView에 그대로 꽂는다. 그래서
가공은 전부 서버에서 끝내고(라벨·값·부제 문자열), 클라이언트는 렌더링만 한다:
  - 파싱 코드가 얇아야 위젯이 안 깨진다(위젯은 크래시해도 사용자가 원인을 못 본다)
  - 표기 규칙(분 반올림·막차 표시·끼니 선택)이 앱과 위젯에서 갈라지지 않는다

type 파라미터로 세 위젯이 같은 엔드포인트를 공유한다:
  transit(기본) — mode=shuttle|subway (하단 칩) + campus/station (헤더 칩).
                  좌우 2열로 등교·하교 / 상행·하행을 나눠 담는다.
  cafeteria     — view=menu|venues (하단 탭) + place=tip|edong (식단 식당 선택)
  calendar      — 다가오는 학사일정 D-day
"""

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
from app.services.cafeteria import get_menu
from app.services.school import get_calendar
from app.services.shuttle import get_next as shuttle_get_next
from app.services.shuttle import get_schedule as shuttle_get_schedule
from app.services.subway import get_next as subway_get_next

logger = logging.getLogger(__name__)
KST = ZoneInfo("Asia/Seoul")

router = APIRouter(prefix="/api/v1/widget", tags=["widget"])

# 지하철 역별 (상행 키, 하행 키, 노선 배지). 위젯은 좌우 2열로 상행·하행을 나눠
# 담으므로 역마다 방향 한 쌍만 있으면 된다. 정왕역은 수인분당·4호선이 함께 서지만
# 위젯 폭상 승객이 실제로 많이 쓰는 수인분당을 기본으로 둔다.
_SUBWAY_STATIONS = {
    "정왕": {"label": "정왕역", "up": ("up", "수"), "down": ("down", "수")},
    "초지": {"label": "초지역", "up": ("choji_up", "서"), "down": ("choji_dn", "서")},
    "시흥시청": {"label": "시흥시청역", "up": ("siheung_up", "서"), "down": ("siheung_dn", "서")},
}

# 셔틀 캠퍼스별 (등교 direction, 하교 direction, 등교 라벨, 하교 라벨)
_SHUTTLE_CAMPUS = {
    "main": (0, 1, "정왕역 → 학교", "학교 → 정왕역"),
    "second": (2, 3, "본교 → 2캠", "2캠 → 본교"),
}


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


def _direction_col(kind: str, badge: str, dir_label: str, data: Any, dest: str = "") -> dict:
    """좌우 2열 중 한 열. 데이터가 없으면 '운행 종료'로 그 열만 저하시킨다.

    위젯이 통째로 비는 것보다 반대 방향이라도 보이는 편이 낫다(열 단위 저하).
    """
    if not isinstance(data, dict) or not data.get("depart_at"):
        return {"kind": kind, "badge": badge, "label": dir_label, "dest": dest,
                "value": "", "sub": "오늘 운행 종료", "empty": True}

    depart = data["depart_at"][:5]
    sub = f"{depart} 출발"
    if data.get("is_last"):
        sub = f"{sub} · 막차"
    elif data.get("next_depart_at"):
        sub = f"{sub} · 다음 {data['next_depart_at'][:5]}"
    elif data.get("last_depart_at"):
        sub = f"막차 {data['last_depart_at']}"
    return {
        "kind": kind,
        "badge": badge,
        "label": dir_label,
        "dest": dest,
        "value": _minutes_text(data.get("arrive_in_seconds")) or depart,
        "sub": sub,
        "empty": False,
    }


def _subway_cols(result: Any, station: str) -> list[dict]:
    meta = _SUBWAY_STATIONS[station]
    cols = []
    for dir_key, dir_label in (("up", "↑ 상행"), ("down", "↓ 하행")):
        key, badge = meta[dir_key]
        train = result.get(key) if isinstance(result, dict) else None
        dest = f"{train.get('destination', '')}" if isinstance(train, dict) else ""
        col = _direction_col("subway", badge, dir_label, train, dest)
        # 지하철은 "다음 차"보다 막차가 급하다(밤에 위젯을 보는 이유).
        if not col["empty"] and isinstance(train, dict) and train.get("last_depart_at"):
            col["sub"] = f"막차 {train['last_depart_at']}"
        cols.append(col)
    return cols


async def _transit_payload(db: AsyncSession, mode: str, campus: str, station: str, now: datetime) -> dict:
    """교통 위젯 — 좌우 2열(등교·하교 / 상행·하행) 페이로드.

    버스는 싣지 않는다: GBIS 실시간은 노선·정류장별 편차가 크고(시간표 폴백 포함),
    위젯에는 "실시간/시간표 기준" 같은 단서를 붙일 자리가 없다. 확인 없이 믿는
    자리에는 신뢰도가 확보된 데이터만 올린다(버스는 앱 홈에서 근거와 함께 본다).
    """
    d, t = now.date(), now.time()

    if mode == "subway":
        station = station if station in _SUBWAY_STATIONS else "정왕"
        result = await _safe(subway_get_next(db, d, t), "subway")
        cols = _subway_cols(result, station)
        return {
            "title": "지하철",
            "selector": {"kind": "station", "value": station, "options": list(_SUBWAY_STATIONS)},
            "columns": cols,
            "empty_text": None if any(not c["empty"] for c in cols) else "오늘 운행이 끝났어요",
        }

    campus = campus if campus in _SHUTTLE_CAMPUS else "main"
    up_dir, down_dir, up_label, down_label = _SHUTTLE_CAMPUS[campus]
    # 한 AsyncSession을 gather로 동시에 쓰면 안 된다 — 셋 중 하나가 조용히 실패해
    # 2캠에서만 기간명이 사라지는 증상이 실제로 났다. 셋 다 Redis 캐시 히트라
    # 순차로 돌려도 비용 차이가 없다.
    up = await _safe(shuttle_get_next(db, d, t, up_dir), "shuttle_up")
    down = await _safe(shuttle_get_next(db, d, t, down_dir), "shuttle_down")
    schedule = await _safe(shuttle_get_schedule(db, d), "shuttle_schedule")
    period = schedule.get("schedule_name") if isinstance(schedule, dict) else None
    cols = [
        _direction_col("shuttle", "등", f"↑ {up_label}", up),
        _direction_col("shuttle", "하", f"↓ {down_label}", down),
    ]
    return {
        "title": f"셔틀 · {period}" if period else "셔틀",
        "selector": {"kind": "campus", "value": campus, "options": ["main", "second"]},
        "columns": cols,
        "empty_text": None if any(not c["empty"] for c in cols) else "오늘은 셔틀이 운행하지 않아요",
    }


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


def _venues_payload(now: datetime) -> dict:
    """운영정보 탭 — 지금 문 연 매장 3곳(마감 임박 순).

    학식이 없는 주말·방학에도 위젯이 쓸모를 유지하는 축이다.
    """
    from app.services.venues import open_venues_now

    # 셔틀 기간과 달리 매장은 학기/방학 스케줄이 따로다 — 3~8월/9~2월 학기 근사.
    season = "semester" if now.month in (3, 4, 5, 6, 9, 10, 11, 12) else "vacation"
    venues = open_venues_now(now, season=season)
    items = [_row("venue", "", v["name"], "", v["close_text"]) for v in venues]
    return {
        "title": "지금 영업 중",
        "meal": f"{len(items)}곳" if items else "",
        "items": items,
        "empty_text": None if items else "지금 문 연 곳이 없어요",
    }


def _cafeteria_payload(menu: Any, now: datetime, place: str = "tip") -> dict:
    """식단 탭 — 식당(TIP 지하 / E동)을 골라 그 식당의 오늘 끼니를 보여준다.

    두 식당은 운영 시간대도 메뉴도 달라서(E동은 조식이 없다) 한쪽만 보여주면
    "오늘 학식 뭐지"의 답이 반쪽이 된다.
    """
    meal_type = _current_meal(now)
    # 크롤 실패·주말 등으로 cafeterias가 아예 비어 올 수 있다(빈 리스트 인덱싱 금지).
    cafeterias = (menu or {}).get("cafeterias") or [] if isinstance(menu, dict) else []
    keyword = "E동" if place == "edong" else "TIP"
    cafeteria = next(
        (c for c in cafeterias if keyword in (c.get("name") or "")),
        cafeterias[0] if cafeterias else {},
    )
    meals = cafeteria.get("meals") or []
    day_key = str(now.day)

    meal = next((m for m in meals if meal_type in (m.get("type") or "")), None)
    items = [i for i in ((meal or {}).get("by_day", {}).get(day_key) or []) if i]

    selector = {"kind": "place", "value": place, "options": ["tip", "edong"]}

    if not items:
        return {
            "title": cafeteria.get("name") or "학식",
            "meal": meal_type,
            "items": [],
            "selector": selector,
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
        "selector": selector,
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
    mode: str = Query("shuttle", pattern="^(shuttle|subway)$", description="transit 전용"),
    campus: str = Query("main", pattern="^(main|second)$", description="셔틀 캠퍼스"),
    station: str = Query("정왕", description="지하철 역 — 정왕 | 초지 | 시흥시청"),
    view: str = Query("menu", pattern="^(menu|venues)$", description="학식 탭"),
    place: str = Query("tip", pattern="^(tip|edong)$", description="식단 식당 — TIP 지하 / E동"),
    db: AsyncSession = Depends(get_db),
):
    """위젯 한 화면(최대 3줄)에 필요한 문자열만 반환한다."""
    now = datetime.now(KST)

    if type == "cafeteria":
        if view == "venues":
            payload = _venues_payload(now)
        else:
            # get_menu는 DB를 쓰지 않는다(외부 크롤 + Redis cache-aside)
            payload = _cafeteria_payload(await _safe(get_menu(), "cafeteria"), now, place)
        payload["view"] = view
    elif type == "calendar":
        payload = _calendar_payload(await _safe(get_calendar(db), "calendar"), now.date())
    else:
        payload = await _transit_payload(db, mode, campus, station, now)

    payload["updated_at"] = now.strftime("%H:%M")
    payload["type"] = type
    payload.setdefault("mode", mode if type == "transit" else "")
    payload.setdefault("columns", [])
    payload.setdefault("items", [])
    payload.setdefault("selector", None)

    # 위젯은 30분 주기 갱신이라 짧은 캐시로 충분하다(동시 요청 폭주 완충).
    response.headers["Cache-Control"] = "public, max-age=20, stale-while-revalidate=60"
    return ApiResponse[WidgetResponse].ok(payload)
