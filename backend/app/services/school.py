"""학사공지(학과별 RSS) + 학사일정 서비스.

요청 경로(API)는 절대 학교 사이트를 직접 호출하지 않는다 — DB + Redis만 본다.
외부 스크레이핑은 `app.core.scheduler`에 등록된 크론 잡에서만 실행되고,
그 결과를 DB에 적재한 뒤 관련 캐시 키를 무효화한다(cache-aside).

캐시 TTL은 갱신 크론 주기보다 짧게 잡아(§CLAUDE.md 캐시 규칙) cron 1회 누락도
다음 요청에서 DB 재조회로 자가회복된다.
"""

import logging
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import delete_keys, get_or_fetch_with_lock
from app.models.school import AcademicCalendarEvent, SchoolBoardNotice

logger = logging.getLogger(__name__)

# ── 공지 카테고리 (DS1) ─────────────────────────────────────────────────
# 학과 공지(RSS)는 2026-08 개편에서 제거됐다 — 전교 게시판 카테고리로 대체.
# 카테고리 원천은 external.tukorea_boards.BOARD_SOURCES (robots.txt 허용 경로만).
from app.services.external.tukorea_boards import BOARD_SOURCES

VALID_CATEGORIES = set(BOARD_SOURCES.keys())

# ── 캐시 키 / TTL ────────────────────────────────────────────────────────
_TTL_NOTICES = 120 * 60  # 120분 — 컴공 공지 갱신 크론(60분)보다 길게 두되,
# cron 1회 누락(다음 60분)에도 자가회복하도록 크론 2주기 이내로 제한.
_TTL_CALENDAR = 25 * 3600  # 25시간 — 학사일정 갱신 크론(1일 1회)보다 살짝 길게.

_KST = ZoneInfo("Asia/Seoul")


def _board_cache_key(category: str) -> str:
    return f"school:board:{category}"


_CALENDAR_CACHE_KEY = "school:calendar"
_LIBRARY_HOURS_CACHE_KEY = "school:library-hours"
_TTL_LIBRARY_HOURS = 6 * 3600  # 개관시간은 방학/학기 전환 때나 바뀜 — 6시간


def is_valid_category(code: str) -> bool:
    return code == "all" or code in VALID_CATEGORIES


# ── 조회 (cache-aside, fetch_fn은 DB 쿼리) ──────────────────────────────


async def get_board_notices(db: AsyncSession, category: str) -> list[dict[str, Any]]:
    """게시판 공지 목록(최신순). category='all'이면 전 카테고리 병합 60건.

    카테고리 유효성은 호출부(API)에서 먼저 검증한다. 각 항목에 category와
    표시 라벨을 함께 실어 프런트가 칩/뱃지를 그리게 한다.
    """

    async def _fetch() -> list[dict[str, Any]]:
        stmt = select(SchoolBoardNotice)
        if category != "all":
            stmt = stmt.where(SchoolBoardNotice.category == category)
        stmt = stmt.order_by(
            SchoolBoardNotice.published_at.desc(), SchoolBoardNotice.external_id.desc()
        ).limit(60 if category == "all" else 30)
        rows = (await db.execute(stmt)).scalars().all()
        return [
            {
                "id": n.external_id,
                "category": n.category,
                "category_label": BOARD_SOURCES.get(n.category, {}).get("label", n.category),
                "title": n.title,
                "url": n.url,
                "published_at": n.published_at.isoformat(),
            }
            for n in rows
        ]

    return await get_or_fetch_with_lock(_board_cache_key(category), _TTL_NOTICES, _fetch)


async def get_library_hours() -> list[dict[str, Any]]:
    """도서관 열람실 개관시간(F7) — cache-aside(6h). 도서관 pyxis 공개 API 원천.

    weather/cafeteria와 같은 cache-aside 도메인: 캐시가 비면 이 요청이 직접
    외부 API를 호출해 채우고, 실패 시 빈 목록으로 저하된다(홈 카드가 조용히 숨음).
    """

    async def _fetch() -> list[dict[str, Any]]:
        from app.services.external.tukorea_library import fetch_library_hours

        try:
            return await fetch_library_hours()
        except Exception:
            logger.exception("도서관 개관시간 조회 실패")
            return []

    return await get_or_fetch_with_lock(_LIBRARY_HOURS_CACHE_KEY, _TTL_LIBRARY_HOURS, _fetch)


async def get_calendar(db: AsyncSession) -> dict[str, Any]:
    """다음 학사일정 1건 + 그 이후 예정 목록.

    `next`는 오늘(KST) 기준으로 아직 끝나지 않은 일정 중 가장 가까운 것,
    `upcoming`은 그 다음으로 시작하는 일정들(진행 중/과거 제외).
    """

    async def _fetch() -> dict[str, Any]:
        today = datetime.now(_KST).date()
        rows = (
            await db.execute(
                select(AcademicCalendarEvent)
                .order_by(AcademicCalendarEvent.start_date.asc())
            )
        ).scalars().all()

        def _end(ev: AcademicCalendarEvent) -> date:
            return ev.end_date or ev.start_date

        upcoming_or_ongoing = [ev for ev in rows if _end(ev) >= today]

        def _to_dict(ev: AcademicCalendarEvent) -> dict[str, Any]:
            return {
                "title": ev.title,
                "start_date": ev.start_date.isoformat(),
                "end_date": (ev.end_date or ev.start_date).isoformat(),
            }

        if not upcoming_or_ongoing:
            return {"next": None, "upcoming": []}

        next_event = upcoming_or_ongoing[0]
        rest = upcoming_or_ongoing[1:]
        return {"next": _to_dict(next_event), "upcoming": [_to_dict(ev) for ev in rest]}

    return await get_or_fetch_with_lock(_CALENDAR_CACHE_KEY, _TTL_CALENDAR, _fetch)


# ── 스케줄러 갱신 진입점 (크론 전용, DB 적재 + 캐시 무효화) ──────────────


async def refresh_board_notices(db: AsyncSession, category: str) -> dict[str, Any]:
    """게시판 목록 1페이지를 스크레이핑해 신규 공지만 삽입한다.

    실패(네트워크/파싱 오류) 시 예외를 삼키지 않고 로깅한 뒤 그대로 두면
    호출부(scheduler job)가 잡아 이전 DB 데이터를 유지한다(graceful degradation).
    """
    from app.services.external.tukorea_boards import fetch_board_notices

    items = await fetch_board_notices(category)
    if not items:
        logger.info("게시판 공지(%s) 신규 항목 없음/빈 응답", category)
        return {"category": category, "fetched": 0, "inserted": 0}

    stmt = pg_insert(SchoolBoardNotice).values(
        [
            {
                "category": category,
                "external_id": item["external_id"],
                "title": item["title"],
                "url": item["url"],
                "published_at": item["published_at"],
            }
            for item in items
        ]
    )
    stmt = stmt.on_conflict_do_nothing(index_elements=["category", "external_id"])
    result = await db.execute(stmt)
    await db.commit()

    await delete_keys(_board_cache_key(category))
    await delete_keys(_board_cache_key("all"))

    inserted = result.rowcount or 0
    logger.info("게시판 공지(%s) 갱신: fetched=%d inserted=%d", category, len(items), inserted)
    return {"category": category, "fetched": len(items), "inserted": inserted}


async def refresh_academic_calendar(db: AsyncSession) -> dict[str, Any]:
    """학사일정 페이지를 스크레이핑해 신규 이벤트만 삽입한다(append-only, 삭제 없음).

    실패 시 예외를 삼키지 않고 로깅한 뒤 그대로 두면 호출부가 잡아 이전 DB
    데이터를 유지한다(graceful degradation).
    """
    from app.services.external.tukorea_calendar import fetch_academic_calendar

    events = await fetch_academic_calendar()
    if not events:
        logger.info("학사일정 신규 항목 없음/빈 응답")
        return {"fetched": 0, "inserted": 0}

    stmt = pg_insert(AcademicCalendarEvent).values(
        [
            {
                "title": ev["title"],
                "start_date": ev["start_date"],
                "end_date": ev["end_date"],
            }
            for ev in events
        ]
    )
    stmt = stmt.on_conflict_do_nothing(
        index_elements=["title", "start_date", "end_date"]
    )
    result = await db.execute(stmt)
    await db.commit()

    await delete_keys(_CALENDAR_CACHE_KEY)

    inserted = result.rowcount or 0
    logger.info("학사일정 갱신: fetched=%d inserted=%d", len(events), inserted)
    return {"fetched": len(events), "inserted": inserted}
