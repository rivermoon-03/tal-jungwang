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
from app.models.subway import SubwayTimetableEntry
from app.schemas.admin import (
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

TAGO_BASE = "https://apis.data.go.kr/1613000/SubwayInfo/GetSubwaySttnAcctoSchdulList"
SUINBUNDANG_ID = "MTRKRK1K257"
LINE4_ID = "MTRKR4455"

# (station_id, daily, ud, day_type, direction)
SUBWAY_COMBOS = [
    (SUINBUNDANG_ID, "01", "U", "weekday", "up"),
    (SUINBUNDANG_ID, "01", "D", "weekday", "down"),
    (SUINBUNDANG_ID, "03", "U", "sunday", "up"),
    (SUINBUNDANG_ID, "03", "D", "sunday", "down"),
    (LINE4_ID, "01", "U", "weekday", "line4_up"),
    (LINE4_ID, "01", "D", "weekday", "line4_down"),
    (LINE4_ID, "03", "U", "sunday", "line4_up"),
    (LINE4_ID, "03", "D", "sunday", "line4_down"),
]


@router.post("/subway/refresh")
async def refresh_subway_timetable(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    """TAGO API에서 정왕역 시간표(수인분당선+4호선)를 새로 가져와 DB를 갱신한다."""
    now = datetime.now(timezone.utc)
    total = 0

    async with httpx.AsyncClient() as client:
        await db.execute(delete(SubwayTimetableEntry))

        for station_id, daily_code, ud_code, day_type, direction in SUBWAY_COMBOS:
            params = {
                "serviceKey": settings.DATA_GO_KR_SERVICE_KEY,
                "subwayStationId": station_id,
                "dailyTypeCode": daily_code,
                "upDownTypeCode": ud_code,
                "numOfRows": 500,
                "_type": "json",
            }
            resp = await client.get(TAGO_BASE, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])
            if isinstance(items, dict):
                items = [items]

            for item in items:
                dep_str = item.get("depTime", "")
                if not dep_str or len(dep_str) < 6:
                    continue
                hh, mm, ss = int(dep_str[:2]), int(dep_str[2:4]), int(dep_str[4:6])
                dest = item.get("endSubwayStationNm", "") or ""
                if not dest and direction == "line4_up":
                    dest = "당고개"
                entry = SubwayTimetableEntry(
                    direction=direction,
                    day_type=day_type,
                    departure_time=time(hh, mm, ss),
                    destination=dest,
                    updated_at=now,
                )
                db.add(entry)
                total += 1

        await db.commit()

    # 지하철 시간표 Redis 캐시 무효화
    from app.core.cache import get_redis
    redis = await get_redis()
    for day in ("weekday", "saturday", "sunday"):
        await redis.delete(f"subway:entries:{day}")

    return ApiResponse.ok({"refreshed": total, "updated_at": now.isoformat()})


# ── GBIS ID 등록 ─────────────────────────────────────────────

GBIS_ROUTE_IDS = {
    "시흥33": "224000062",
    "20-1": "224000023",
    "시흥1": "213000006",
}

GBIS_STATION_IDS = {
    "한국공학대학교": "224000639",
    "이마트 (6502·시흥1번 정류장)": "224000513",
}


@router.post("/bus/register-gbis-ids")
async def register_gbis_ids(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(verify_token),
):
    """버스 노선·정류장에 GBIS ID를 등록하고 is_realtime을 활성화한다."""
    from sqlalchemy import update
    from app.models.bus import BusRoute, BusStop

    updated_routes = []
    updated_stops = []

    for route_number, gbis_route_id in GBIS_ROUTE_IDS.items():
        await db.execute(
            update(BusRoute)
            .where(BusRoute.route_number == route_number)
            .values(gbis_route_id=gbis_route_id, is_realtime=True)
        )
        updated_routes.append(route_number)

    for name, gbis_station_id in GBIS_STATION_IDS.items():
        await db.execute(
            update(BusStop)
            .where(BusStop.name == name)
            .values(gbis_station_id=gbis_station_id)
        )
        updated_stops.append(name)

    await db.commit()

    return ApiResponse.ok({
        "updated_routes": updated_routes,
        "updated_stops": updated_stops,
    })
