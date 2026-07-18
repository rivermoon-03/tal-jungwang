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
from app.models.school import AcademicCalendarEvent, DepartmentNotice

logger = logging.getLogger(__name__)

# ── 학과 레지스트리 ──────────────────────────────────────────────────────
# 코드 레벨 registry — robots.txt로 Allow 확인된 학과만 추가할 것
# (app.services.external.tukorea_notices.DEPARTMENT_RSS_URLS와 1:1 대응).
DEPARTMENTS: list[dict[str, str]] = [
    {"code": "ce", "label": "컴퓨터공학부"},
]
_DEPARTMENT_CODES = {d["code"] for d in DEPARTMENTS}

# ── 캐시 키 / TTL ────────────────────────────────────────────────────────
_TTL_NOTICES = 120 * 60  # 120분 — 컴공 공지 갱신 크론(60분)보다 길게 두되,
# cron 1회 누락(다음 60분)에도 자가회복하도록 크론 2주기 이내로 제한.
_TTL_CALENDAR = 25 * 3600  # 25시간 — 학사일정 갱신 크론(1일 1회)보다 살짝 길게.

_KST = ZoneInfo("Asia/Seoul")


def _notices_cache_key(department: str) -> str:
    return f"school:notices:{department}"


_CALENDAR_CACHE_KEY = "school:calendar"


def list_departments() -> list[dict[str, str]]:
    return DEPARTMENTS


def is_valid_department(code: str) -> bool:
    return code in _DEPARTMENT_CODES


# ── 조회 (cache-aside, fetch_fn은 DB 쿼리) ──────────────────────────────


async def get_notices(db: AsyncSession, department: str) -> list[dict[str, Any]]:
    """학과 공지 목록(최신순). department 유효성은 호출부(API)에서 먼저 검증한다."""

    async def _fetch() -> list[dict[str, Any]]:
        rows = (
            await db.execute(
                select(DepartmentNotice)
                .where(DepartmentNotice.department == department)
                .order_by(DepartmentNotice.published_at.desc())
            )
        ).scalars().all()
        return [
            {
                "id": n.external_id,
                "title": n.title,
                "url": n.url,
                "published_at": n.published_at.isoformat(),
            }
            for n in rows
        ]

    return await get_or_fetch_with_lock(_notices_cache_key(department), _TTL_NOTICES, _fetch)


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


async def refresh_department_notices(db: AsyncSession, department: str) -> dict[str, Any]:
    """학과 RSS를 스크레이핑해 신규 공지만 삽입한다.

    실패(네트워크/파싱 오류) 시 예외를 삼키지 않고 로깅한 뒤 그대로 두면
    호출부(scheduler job)가 잡아 이전 DB 데이터를 유지한다(graceful degradation).
    """
    from app.services.external.tukorea_notices import fetch_department_notices

    items = await fetch_department_notices(department)
    if not items:
        logger.info("학과 공지(%s) 신규 항목 없음/빈 응답", department)
        return {"department": department, "fetched": 0, "inserted": 0}

    stmt = pg_insert(DepartmentNotice).values(
        [
            {
                "department": department,
                "external_id": item["external_id"],
                "title": item["title"],
                "url": item["url"],
                "published_at": item["published_at"],
            }
            for item in items
        ]
    )
    stmt = stmt.on_conflict_do_nothing(
        index_elements=["department", "external_id"]
    )
    result = await db.execute(stmt)
    await db.commit()

    await delete_keys(_notices_cache_key(department))

    inserted = result.rowcount or 0
    logger.info("학과 공지(%s) 갱신: fetched=%d inserted=%d", department, len(items), inserted)
    return {"department": department, "fetched": len(items), "inserted": inserted}


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
