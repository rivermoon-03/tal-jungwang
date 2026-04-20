from datetime import date, datetime, time, timezone

import jwt
import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials
import bcrypt as _bcrypt
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import bearer, verify_token
from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.models.shuttle import SchedulePeriod, ShuttleRoute, ShuttleTimetableEntry
from app.schemas.admin import (
    BusRouteCreate,
    BusRouteOut,
    BusRouteUpdate,
    BusStopCreate,
    BusStopOut,
    BusStopRouteCreate,
    BusStopUpdate,
    BusTimetableEntryOut,
    BusTimetableUpload,
    LoginRequest,
    LoginResponse,
    ScheduleCreate,
    ScheduleResponse,
    ScheduleUpdate,
    TimetableUpload,
)
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

# ── JWT helpers ──────────────────────────────────────────────

def _create_token(sub: str) -> tuple[str, int]:
    exp_minutes = settings.JWT_EXPIRE_MINUTES
    exp = int(datetime.now(timezone.utc).timestamp()) + exp_minutes * 60
    token = jwt.encode(
        {"sub": sub, "exp": exp},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token, exp_minutes * 60


# ── Login ────────────────────────────────────────────────────

@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest):
    # 타이밍 공격 방지: username 불일치이더라도 bcrypt 연산을 항상 실행
    stored_hash = settings.ADMIN_PASSWORD_HASH.encode()
    _dummy = b"$2b$12$invalidhashfortimingprotectionXXXXXXXXXXXXXXXXXXXXXXXX"
    username_ok = body.username == settings.ADMIN_USERNAME
    hash_to_check = stored_hash if username_ok else _dummy
    pw_ok = _bcrypt.checkpw(body.password.encode(), hash_to_check)
    if not (username_ok and pw_ok):
        return ApiResponse.fail("AUTH_FAILED", "아이디 또는 비밀번호가 올바르지 않습니다.")

    token, expires_in = _create_token(body.username)
    return ApiResponse[LoginResponse].ok(
        LoginResponse(access_token=token, expires_in=expires_in)
    )


# ── Schedule Period CRUD ─────────────────────────────────────

@router.get("/schedules")
async def list_schedules(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    stmt = select(SchedulePeriod).order_by(SchedulePeriod.start_date.desc())
    result = await db.execute(stmt)
    rows = result.scalars().all()
    data = [
        ScheduleResponse(
            id=r.id,
            type=r.period_type,
            name=r.name,
            valid_from=r.start_date.isoformat(),
            valid_until=r.end_date.isoformat(),
            priority=r.priority,
            notice_message=r.notice_message,
        )
        for r in rows
    ]
    return ApiResponse[list[ScheduleResponse]].ok(data)


@router.post("/schedules")
async def create_schedule(
    body: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    period = SchedulePeriod(
        period_type=body.type,
        name=body.name,
        start_date=date.fromisoformat(body.valid_from),
        end_date=date.fromisoformat(body.valid_until),
        priority=body.priority,
        notice_message=body.notice_message,
        created_at=datetime.now(timezone.utc),
    )
    db.add(period)
    await db.commit()
    await db.refresh(period)

    return ApiResponse[ScheduleResponse].ok(
        ScheduleResponse(
            id=period.id,
            type=period.period_type,
            name=period.name,
            valid_from=period.start_date.isoformat(),
            valid_until=period.end_date.isoformat(),
            priority=period.priority,
            notice_message=period.notice_message,
        )
    )


@router.patch("/schedules/{schedule_id}")
async def update_schedule(
    schedule_id: int,
    body: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    stmt = select(SchedulePeriod).where(SchedulePeriod.id == schedule_id)
    result = await db.execute(stmt)
    period = result.scalar_one_or_none()
    if not period:
        return ApiResponse.fail("NOT_FOUND", "해당 스케줄이 존재하지 않습니다.")

    if body.type is not None:
        period.period_type = body.type
    if body.name is not None:
        period.name = body.name
    if body.valid_from is not None:
        period.start_date = date.fromisoformat(body.valid_from)
    if body.valid_until is not None:
        period.end_date = date.fromisoformat(body.valid_until)
    if body.priority is not None:
        period.priority = body.priority
    if body.notice_message is not None:
        period.notice_message = body.notice_message

    await db.commit()
    await db.refresh(period)

    return ApiResponse[ScheduleResponse].ok(
        ScheduleResponse(
            id=period.id,
            type=period.period_type,
            name=period.name,
            valid_from=period.start_date.isoformat(),
            valid_until=period.end_date.isoformat(),
            priority=period.priority,
            notice_message=period.notice_message,
        )
    )


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    stmt = select(SchedulePeriod).where(SchedulePeriod.id == schedule_id)
    result = await db.execute(stmt)
    period = result.scalar_one_or_none()
    if not period:
        return ApiResponse.fail("NOT_FOUND", "해당 스케줄이 존재하지 않습니다.")

    await db.delete(period)
    await db.commit()
    return ApiResponse.ok({"deleted": schedule_id})


# ── Shuttle Timetable Upload ─────────────────────────────────

@router.post("/schedules/{schedule_id}/routes/{route_id}/timetable")
async def upload_timetable(
    schedule_id: int,
    route_id: int,
    body: TimetableUpload,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    # Verify schedule and route exist
    period = (await db.execute(
        select(SchedulePeriod).where(SchedulePeriod.id == schedule_id)
    )).scalar_one_or_none()
    if not period:
        return ApiResponse.fail("NOT_FOUND", "해당 스케줄이 존재하지 않습니다.")

    route = (await db.execute(
        select(ShuttleRoute).where(ShuttleRoute.id == route_id)
    )).scalar_one_or_none()
    if not route:
        return ApiResponse.fail("NOT_FOUND", "해당 노선이 존재하지 않습니다.")

    # Delete existing entries for this combo
    await db.execute(
        delete(ShuttleTimetableEntry).where(
            ShuttleTimetableEntry.schedule_period_id == schedule_id,
            ShuttleTimetableEntry.shuttle_route_id == route_id,
            ShuttleTimetableEntry.day_type == body.day_type,
        )
    )

    count = 0
    for t in body.times:
        dep_time = time(int(t.depart_at[:2]), int(t.depart_at[3:5]))
        entry = ShuttleTimetableEntry(
            schedule_period_id=schedule_id,
            shuttle_route_id=route_id,
            day_type=body.day_type,
            departure_time=dep_time,
            note=t.note,
        )
        db.add(entry)
        count += 1

    await db.commit()
    return ApiResponse.ok({"uploaded": count, "day_type": body.day_type})


# ── Subway Timetable Refresh (TAGO API) ──────────────────────

@router.post("/subway/refresh")
async def refresh_subway_timetable(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    """TAGO API에서 정왕역 시간표(수인분당선+4호선)를 새로 가져와 DB를 갱신한다."""
    from app.services.subway import refresh_timetable
    from datetime import timezone

    total = await refresh_timetable(db)
    return ApiResponse.ok({"refreshed": total, "updated_at": datetime.now(timezone.utc).isoformat()})


# ── 등교 셔틀 시간표 시드 ────────────────────────────────────

_OUTBOUND_DIRECTION = 0  # 0=등교, 1=하교
_OUTBOUND_DESC = "정왕역 출발 → 한국공학대학교/경기과학기술대학교 (등교)"
_OUTBOUND_TIMETABLE: list[tuple[time, str | None]] = [
    (time(8, 40),  "수시운행"), (time(8, 50),  "수시운행"), (time(9, 0),   "수시운행"),
    (time(9, 10),  "수시운행"), (time(9, 20),  "수시운행"), (time(9, 30),  "수시운행"),
    (time(9, 40),  "수시운행"), (time(9, 50),  "수시운행"), (time(10, 0),  "수시운행"),
    (time(10, 10), None), (time(10, 15), None), (time(10, 20), None),
    (time(10, 30), None), (time(10, 50), None),
    (time(11, 0),  None), (time(11, 10), None), (time(11, 20), None),
    (time(11, 30), None), (time(11, 50), None),
    (time(12, 0),  None), (time(12, 10), None), (time(12, 20), None),
    (time(12, 30), None), (time(12, 50), None),
    (time(13, 0),  None), (time(13, 10), None), (time(13, 20), None),
    (time(13, 30), None), (time(13, 50), None),
    (time(14, 0),  None), (time(14, 10), None), (time(14, 20), None), (time(14, 40), None),
    (time(15, 0),  None), (time(15, 10), None), (time(15, 20), None), (time(15, 40), None),
    (time(16, 0),  None), (time(16, 20), None), (time(16, 30), None),
    (time(16, 40), None), (time(16, 50), None),
    (time(17, 10), "회차편 · 학교 수시운행 출발"),
    (time(18, 10), "회차편 · 학교 18:00 출발"),
    (time(18, 20), "회차편 · 학교 18:10 출발"),
    (time(18, 30), "회차편 · 학교 18:20 출발"),
    (time(18, 40), "회차편 · 학교 18:30 출발"),
    (time(18, 50), "회차편 · 학교 18:40 출발"),
    (time(19,  0), "회차편 · 학교 18:50 출발"),
    (time(19, 15), "회차편 · 학교 19:05 출발"),
    (time(19, 25), "회차편 · 학교 19:15 출발"),
    (time(19, 40), "회차편 · 학교 19:30 출발"),
    (time(19, 55), "회차편 · 학교 19:45 출발"),
    (time(20, 15), "회차편 · 학교 20:05 출발"),
    (time(20, 35), "회차편 · 학교 20:25 출발"),
    (time(20, 55), "회차편 · 학교 20:45 출발"),
    (time(21, 10), "회차편 · 학교 21:00 출발"),
    (time(21, 30), "회차편 · 학교 21:20 출발"),
    (time(21, 58), "회차편 · 학교 21:48 출발"),
    (time(22, 17), "막차"),
]


@router.post("/shuttle/seed-outbound")
async def seed_outbound_shuttle(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    """등교(학교행) 셔틀 평일 시간표를 모든 활성 SchedulePeriod에 삽입한다. 멱등."""
    today = date.today()

    period_rows = await db.execute(
        select(SchedulePeriod)
        .where(SchedulePeriod.start_date <= today, SchedulePeriod.end_date >= today)
        .order_by(SchedulePeriod.priority.desc())
    )
    periods = period_rows.scalars().all()
    if not periods:
        return ApiResponse.fail("NO_PERIOD", "활성 SchedulePeriod가 없습니다.")

    # ShuttleRoute upsert
    route_row = await db.execute(
        select(ShuttleRoute).where(ShuttleRoute.direction == _OUTBOUND_DIRECTION)
    )
    route = route_row.scalar_one_or_none()
    if route is None:
        route = ShuttleRoute(direction=_OUTBOUND_DIRECTION, description=_OUTBOUND_DESC)
        db.add(route)
        await db.flush()

    # 기존 평일 항목 삭제 (멱등성)
    await db.execute(
        delete(ShuttleTimetableEntry).where(
            ShuttleTimetableEntry.shuttle_route_id == route.id,
            ShuttleTimetableEntry.day_type == "weekday",
        )
    )

    # 모든 활성 기간에 삽입
    for period in periods:
        for dep_time, note in _OUTBOUND_TIMETABLE:
            db.add(ShuttleTimetableEntry(
                schedule_period_id=period.id,
                shuttle_route_id=route.id,
                day_type="weekday",
                departure_time=dep_time,
                note=note,
            ))

    await db.commit()

    return ApiResponse.ok({
        "direction": _OUTBOUND_DIRECTION,
        "periods": len(periods),
        "entries": len(periods) * len(_OUTBOUND_TIMETABLE),
    })



# ── More 관리 ─────────────────────────────────────────────────
from app.models.more import AppInfo as AppInfoModel
from app.models.more import AppLink as AppLinkModel
from app.models.more import Notice as NoticeModel
from app.schemas.more import (
    AppInfoOut, AppInfoUpdate,
    AppLinkCreate, AppLinkOut, AppLinkUpdate,
    NoticeCreate, NoticeOut, NoticeUpdate,
)
from app.services.more import invalidate_info, invalidate_links, invalidate_notices
from app.services.map_markers import invalidate_markers_cache


@router.get("/notices", response_model=ApiResponse[list[NoticeOut]])
async def admin_list_notices(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    rows = await db.execute(select(NoticeModel).order_by(NoticeModel.created_at.desc()))
    return ApiResponse.ok(rows.scalars().all())


@router.post("/notices", response_model=ApiResponse[NoticeOut])
async def admin_create_notice(
    body: NoticeCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    notice = NoticeModel(**body.model_dump())
    db.add(notice)
    await db.commit()
    await db.refresh(notice)
    await invalidate_notices()
    return ApiResponse.ok(notice)


@router.patch("/notices/{notice_id}", response_model=ApiResponse[NoticeOut])
async def admin_update_notice(
    notice_id: int,
    body: NoticeUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    notice = await db.get(NoticeModel, notice_id)
    if not notice:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(notice, field, value)
    await db.commit()
    await db.refresh(notice)
    await invalidate_notices()
    return ApiResponse.ok(notice)


@router.delete("/notices/{notice_id}", response_model=ApiResponse[dict])
async def admin_delete_notice(
    notice_id: int,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    notice = await db.get(NoticeModel, notice_id)
    if not notice:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다.")
    await db.delete(notice)
    await db.commit()
    await invalidate_notices()
    return ApiResponse.ok({"deleted": notice_id})


@router.get("/links", response_model=ApiResponse[list[AppLinkOut]])
async def admin_list_links(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    rows = await db.execute(select(AppLinkModel).order_by(AppLinkModel.sort_order))
    return ApiResponse.ok(rows.scalars().all())


@router.post("/links", response_model=ApiResponse[AppLinkOut])
async def admin_create_link(
    body: AppLinkCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    link = AppLinkModel(**body.model_dump())
    db.add(link)
    await db.commit()
    await db.refresh(link)
    await invalidate_links()
    return ApiResponse.ok(link)


@router.patch("/links/{link_id}", response_model=ApiResponse[AppLinkOut])
async def admin_update_link(
    link_id: int,
    body: AppLinkUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    link = await db.get(AppLinkModel, link_id)
    if not link:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="링크를 찾을 수 없습니다.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(link, field, value)
    await db.commit()
    await db.refresh(link)
    await invalidate_links()
    return ApiResponse.ok(link)


@router.delete("/links/{link_id}", response_model=ApiResponse[dict])
async def admin_delete_link(
    link_id: int,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    link = await db.get(AppLinkModel, link_id)
    if not link:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="링크를 찾을 수 없습니다.")
    await db.delete(link)
    await db.commit()
    await invalidate_links()
    return ApiResponse.ok({"deleted": link_id})


@router.get("/info", response_model=ApiResponse[AppInfoOut])
async def admin_get_info(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    info = await db.get(AppInfoModel, 1)
    if not info:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="앱 정보가 없습니다.")
    return ApiResponse.ok(info)


@router.patch("/info", response_model=ApiResponse[AppInfoOut])
async def admin_update_info(
    body: AppInfoUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    info = await db.get(AppInfoModel, 1)
    if not info:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="앱 정보가 없습니다.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(info, field, value)
    await db.commit()
    await db.refresh(info)
    await invalidate_info()
    return ApiResponse.ok(info)


# ── Bus 관리 (AI/스크립트에서도 사용 가능) ───────────────────
from sqlalchemy import and_, func
from sqlalchemy.orm import selectinload

from app.models.bus import (
    BusRoute as BusRouteModel,
    BusStop as BusStopModel,
    BusStopRoute as BusStopRouteModel,
    BusTimetableEntry as BusTimetableEntryModel,
)


def _route_to_out(route: BusRouteModel, stop_count: int = 0, tt_count: int = 0) -> BusRouteOut:
    return BusRouteOut(
        id=route.id,
        route_number=route.route_number,
        route_name=route.route_name,
        direction_name=route.direction_name,
        category=route.category,
        is_realtime=route.is_realtime,
        gbis_route_id=route.gbis_route_id,
        stop_count=stop_count,
        timetable_count=tt_count,
    )


def _stop_to_out(stop: BusStopModel) -> BusStopOut:
    return BusStopOut(
        id=stop.id,
        name=stop.name,
        sub_name=stop.sub_name,
        gbis_station_id=stop.gbis_station_id,
        lat=float(stop.lat),
        lng=float(stop.lng),
    )


@router.get(
    "/bus/routes",
    response_model=ApiResponse[list[BusRouteOut]],
    summary="버스 노선 목록 조회",
    description="필터: is_realtime(true/false), q(route_number 부분일치). stop_count/timetable_count 포함.",
)
async def admin_list_bus_routes(
    is_realtime: bool | None = None,
    q: str | None = None,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    stmt = select(BusRouteModel).order_by(BusRouteModel.route_number)
    if is_realtime is True:
        stmt = stmt.where(BusRouteModel.gbis_route_id.is_not(None))
    elif is_realtime is False:
        stmt = stmt.where(BusRouteModel.gbis_route_id.is_(None))
    if q:
        stmt = stmt.where(BusRouteModel.route_number.ilike(f"%{q}%"))
    if category:
        stmt = stmt.where(BusRouteModel.category == category)
    routes = (await db.execute(stmt)).scalars().all()

    if not routes:
        return ApiResponse.ok([])

    route_ids = [r.id for r in routes]
    stop_counts = dict(
        (
            await db.execute(
                select(BusStopRouteModel.bus_route_id, func.count())
                .where(BusStopRouteModel.bus_route_id.in_(route_ids))
                .group_by(BusStopRouteModel.bus_route_id)
            )
        ).all()
    )
    tt_counts = dict(
        (
            await db.execute(
                select(BusTimetableEntryModel.route_id, func.count())
                .where(BusTimetableEntryModel.route_id.in_(route_ids))
                .group_by(BusTimetableEntryModel.route_id)
            )
        ).all()
    )

    data = [_route_to_out(r, stop_counts.get(r.id, 0), tt_counts.get(r.id, 0)) for r in routes]
    return ApiResponse.ok(data)


@router.get("/bus/routes/{route_id}", response_model=ApiResponse[BusRouteOut])
async def admin_get_bus_route(
    route_id: int,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    route = await db.get(BusRouteModel, route_id)
    if not route:
        return ApiResponse.fail("ROUTE_NOT_FOUND", "해당 노선이 존재하지 않습니다.")
    stop_count = (
        await db.execute(
            select(func.count()).where(BusStopRouteModel.bus_route_id == route_id)
        )
    ).scalar_one()
    tt_count = (
        await db.execute(
            select(func.count()).where(BusTimetableEntryModel.route_id == route_id)
        )
    ).scalar_one()
    return ApiResponse.ok(_route_to_out(route, stop_count, tt_count))


@router.post("/bus/routes", response_model=ApiResponse[BusRouteOut])
async def admin_create_bus_route(
    body: BusRouteCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    existing = (
        await db.execute(
            select(BusRouteModel).where(BusRouteModel.route_number == body.route_number)
        )
    ).scalar_one_or_none()
    if existing:
        return ApiResponse.fail(
            "ROUTE_DUPLICATE",
            f"route_number '{body.route_number}' 이미 존재 (id={existing.id})",
        )
    route = BusRouteModel(**body.model_dump(exclude={"is_realtime"}))
    db.add(route)
    await db.commit()
    await db.refresh(route)
    return ApiResponse.ok(_route_to_out(route))


@router.patch("/bus/routes/{route_id}", response_model=ApiResponse[BusRouteOut])
async def admin_update_bus_route(
    route_id: int,
    body: BusRouteUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    route = await db.get(BusRouteModel, route_id)
    if not route:
        return ApiResponse.fail("ROUTE_NOT_FOUND", "해당 노선이 존재하지 않습니다.")
    for k, v in body.model_dump(exclude_unset=True, exclude={"is_realtime"}).items():
        setattr(route, k, v)
    await db.commit()
    await db.refresh(route)
    return ApiResponse.ok(_route_to_out(route))


@router.delete("/bus/routes/{route_id}", response_model=ApiResponse[dict])
async def admin_delete_bus_route(
    route_id: int,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    route = await db.get(BusRouteModel, route_id)
    if not route:
        return ApiResponse.fail("ROUTE_NOT_FOUND", "해당 노선이 존재하지 않습니다.")
    await db.delete(route)
    await db.commit()
    return ApiResponse.ok({"deleted": route_id})


@router.get(
    "/bus/stops",
    response_model=ApiResponse[list[BusStopOut]],
    summary="버스 정류장 목록 조회",
    description="필터: q(name 부분일치), route_id(해당 노선에 연결된 정류장만).",
)
async def admin_list_bus_stops(
    q: str | None = None,
    route_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    stmt = select(BusStopModel).order_by(BusStopModel.name)
    if q:
        stmt = stmt.where(BusStopModel.name.ilike(f"%{q}%"))
    if route_id is not None:
        stmt = stmt.join(
            BusStopRouteModel, BusStopRouteModel.bus_stop_id == BusStopModel.id
        ).where(BusStopRouteModel.bus_route_id == route_id)
    stops = (await db.execute(stmt)).scalars().all()
    return ApiResponse.ok([_stop_to_out(s) for s in stops])


@router.post("/bus/stops", response_model=ApiResponse[BusStopOut])
async def admin_create_bus_stop(
    body: BusStopCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    if body.gbis_station_id:
        existing = (
            await db.execute(
                select(BusStopModel).where(BusStopModel.gbis_station_id == body.gbis_station_id)
            )
        ).scalar_one_or_none()
        if existing:
            return ApiResponse.fail(
                "STOP_DUPLICATE",
                f"gbis_station_id '{body.gbis_station_id}' 이미 존재 (id={existing.id})",
            )
    stop = BusStopModel(**body.model_dump())
    db.add(stop)
    await db.commit()
    await db.refresh(stop)
    return ApiResponse.ok(_stop_to_out(stop))


@router.patch("/bus/stops/{stop_id}", response_model=ApiResponse[BusStopOut])
async def admin_update_bus_stop(
    stop_id: int,
    body: BusStopUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    stop = await db.get(BusStopModel, stop_id)
    if not stop:
        return ApiResponse.fail("STOP_NOT_FOUND", "해당 정류장이 존재하지 않습니다.")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(stop, k, v)
    await db.commit()
    await db.refresh(stop)
    return ApiResponse.ok(_stop_to_out(stop))


@router.delete("/bus/stops/{stop_id}", response_model=ApiResponse[dict])
async def admin_delete_bus_stop(
    stop_id: int,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    stop = await db.get(BusStopModel, stop_id)
    if not stop:
        return ApiResponse.fail("STOP_NOT_FOUND", "해당 정류장이 존재하지 않습니다.")
    await db.delete(stop)
    await db.commit()
    return ApiResponse.ok({"deleted": stop_id})


@router.post(
    "/bus/stop-routes",
    response_model=ApiResponse[dict],
    summary="정류장↔노선 연결",
)
async def admin_create_stop_route(
    body: BusStopRouteCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    stop = await db.get(BusStopModel, body.bus_stop_id)
    route = await db.get(BusRouteModel, body.bus_route_id)
    if not stop:
        return ApiResponse.fail("STOP_NOT_FOUND", "해당 정류장이 존재하지 않습니다.")
    if not route:
        return ApiResponse.fail("ROUTE_NOT_FOUND", "해당 노선이 존재하지 않습니다.")
    existing = (
        await db.execute(
            select(BusStopRouteModel).where(
                and_(
                    BusStopRouteModel.bus_stop_id == body.bus_stop_id,
                    BusStopRouteModel.bus_route_id == body.bus_route_id,
                )
            )
        )
    ).scalar_one_or_none()
    if existing:
        return ApiResponse.ok({"bus_stop_id": body.bus_stop_id, "bus_route_id": body.bus_route_id, "created": False})
    db.add(BusStopRouteModel(bus_stop_id=body.bus_stop_id, bus_route_id=body.bus_route_id))
    await db.commit()
    return ApiResponse.ok({"bus_stop_id": body.bus_stop_id, "bus_route_id": body.bus_route_id, "created": True})


@router.delete(
    "/bus/stop-routes",
    response_model=ApiResponse[dict],
    summary="정류장↔노선 연결 해제",
)
async def admin_delete_stop_route(
    bus_stop_id: int,
    bus_route_id: int,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    result = await db.execute(
        delete(BusStopRouteModel).where(
            and_(
                BusStopRouteModel.bus_stop_id == bus_stop_id,
                BusStopRouteModel.bus_route_id == bus_route_id,
            )
        )
    )
    await db.commit()
    return ApiResponse.ok({"deleted": result.rowcount})


@router.get(
    "/bus/routes/{route_id}/timetable",
    response_model=ApiResponse[list[BusTimetableEntryOut]],
    summary="버스 시간표 조회",
    description="필터: stop_id, day_type",
)
async def admin_list_bus_timetable(
    route_id: int,
    stop_id: int | None = None,
    day_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    route = await db.get(BusRouteModel, route_id)
    if not route:
        return ApiResponse.fail("ROUTE_NOT_FOUND", "해당 노선이 존재하지 않습니다.")
    stmt = (
        select(BusTimetableEntryModel, BusStopModel.name)
        .join(BusStopModel, BusStopModel.id == BusTimetableEntryModel.stop_id)
        .where(BusTimetableEntryModel.route_id == route_id)
        .order_by(BusTimetableEntryModel.day_type, BusStopModel.name, BusTimetableEntryModel.departure_time)
    )
    if stop_id is not None:
        stmt = stmt.where(BusTimetableEntryModel.stop_id == stop_id)
    if day_type is not None:
        stmt = stmt.where(BusTimetableEntryModel.day_type == day_type)
    rows = (await db.execute(stmt)).all()
    data = [
        BusTimetableEntryOut(
            id=e.id,
            route_id=e.route_id,
            stop_id=e.stop_id,
            stop_name=stop_name,
            day_type=e.day_type,
            departure_time=e.departure_time.strftime("%H:%M"),
            note=e.note,
        )
        for (e, stop_name) in rows
    ]
    return ApiResponse.ok(data)


@router.post(
    "/bus/routes/{route_id}/timetable",
    response_model=ApiResponse[dict],
    summary="버스 시간표 업로드",
    description=(
        "mode=replace: 각 entry의 (stop,day_type) 조합에 해당하는 기존 항목 전부 삭제 후 삽입. "
        "mode=append: 기존 유지하고 추가만. "
        "entries[].stop_id 또는 stop_name 중 하나 필수 (stop_name은 정확 일치)."
    ),
)
async def admin_upload_bus_timetable(
    route_id: int,
    body: BusTimetableUpload,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    route = await db.get(BusRouteModel, route_id)
    if not route:
        return ApiResponse.fail("ROUTE_NOT_FOUND", "해당 노선이 존재하지 않습니다.")

    # stop resolve
    resolved: list[tuple[int, str, list[str], str | None]] = []  # (stop_id, day_type, times, note)
    for entry in body.entries:
        stop_id = entry.stop_id
        if stop_id is None:
            if not entry.stop_name:
                return ApiResponse.fail("STOP_REQUIRED", "stop_id 또는 stop_name 중 하나가 필요합니다.")
            stop = (
                await db.execute(
                    select(BusStopModel).where(BusStopModel.name == entry.stop_name)
                )
            ).scalar_one_or_none()
            if not stop:
                return ApiResponse.fail(
                    "STOP_NOT_FOUND", f"정류장 이름으로 찾을 수 없음: '{entry.stop_name}'"
                )
            stop_id = stop.id
        else:
            stop = await db.get(BusStopModel, stop_id)
            if not stop:
                return ApiResponse.fail("STOP_NOT_FOUND", f"stop_id={stop_id} 정류장을 찾을 수 없음")
        resolved.append((stop_id, entry.day_type, entry.times, entry.note))

    deleted_count = 0
    if body.mode == "replace":
        for stop_id, day_type, _times, _note in resolved:
            r = await db.execute(
                delete(BusTimetableEntryModel).where(
                    and_(
                        BusTimetableEntryModel.route_id == route_id,
                        BusTimetableEntryModel.stop_id == stop_id,
                        BusTimetableEntryModel.day_type == day_type,
                    )
                )
            )
            deleted_count += r.rowcount or 0

    inserted = 0
    for stop_id, day_type, times_list, note in resolved:
        for t in times_list:
            db.add(
                BusTimetableEntryModel(
                    route_id=route_id,
                    stop_id=stop_id,
                    day_type=day_type,
                    departure_time=time(int(t[:2]), int(t[3:5])),
                    note=note,
                )
            )
            inserted += 1

    await db.commit()
    return ApiResponse.ok({
        "route_id": route_id,
        "mode": body.mode,
        "deleted": deleted_count,
        "inserted": inserted,
    })


@router.delete(
    "/bus/routes/{route_id}/timetable",
    response_model=ApiResponse[dict],
    summary="버스 시간표 삭제",
    description="필터: stop_id, day_type. 필터 없으면 해당 노선의 모든 시간표 삭제.",
)
async def admin_delete_bus_timetable(
    route_id: int,
    stop_id: int | None = None,
    day_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    route = await db.get(BusRouteModel, route_id)
    if not route:
        return ApiResponse.fail("ROUTE_NOT_FOUND", "해당 노선이 존재하지 않습니다.")
    conditions = [BusTimetableEntryModel.route_id == route_id]
    if stop_id is not None:
        conditions.append(BusTimetableEntryModel.stop_id == stop_id)
    if day_type is not None:
        conditions.append(BusTimetableEntryModel.day_type == day_type)
    result = await db.execute(delete(BusTimetableEntryModel).where(and_(*conditions)))
    await db.commit()
    return ApiResponse.ok({"deleted": result.rowcount})


@router.post("/cache/markers/invalidate", response_model=ApiResponse[dict])
async def admin_invalidate_markers_cache(_user: str = Depends(verify_token)):
    await invalidate_markers_cache()
    return ApiResponse.ok({"invalidated": "map:markers"})
