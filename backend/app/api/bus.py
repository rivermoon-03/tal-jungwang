import json
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_redis
from app.core.database import get_db
from app.core.limiter import limiter
from app.models.bus import BusArrivalHistory, BusRoute, BusStop, BusStopRoute
from app.schemas.common import ApiResponse
from app.schemas.bus import (
    BusArrivalsResponse,
    BusRouteStop,
    BusRouteSummary,
    BusStationResponse,
    BusTimetableResponse,
)
from app.core.cache import get_cached_json, set_cached_json
from app.services.bus import get_arrivals, get_stations, get_timetable, get_timetable_by_route_number
from app.services.external.gbis import fetch_bus_locations

router = APIRouter(prefix="/api/v1/bus", tags=["bus"])

_LOCATIONS_CACHE_TTL = 30  # 초 — 버스 폴링 간격과 동일
_ROUTES_CACHE_TTL = 3600   # 노선 목록은 정적 데이터 — 1시간 캐시


@router.get("/routes")
@limiter.limit("30/minute")
async def bus_routes(
    request: Request,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """노선 목록. category(등교/하교/기타) 필터 가능. 각 노선의 stops 포함."""
    cache_key = f"bus:routes:{category or 'all'}"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        return ApiResponse[list[BusRouteSummary]].ok(cached)

    stmt = select(BusRoute).order_by(BusRoute.route_number, BusRoute.direction_name)
    if category:
        stmt = stmt.where(BusRoute.category == category)
    routes = (await db.execute(stmt)).scalars().all()

    if not routes:
        return ApiResponse[list[BusRouteSummary]].ok([])

    route_ids = [r.id for r in routes]
    stop_rows = (
        await db.execute(
            select(BusStopRoute.bus_route_id, BusStop.id, BusStop.name, BusStop.sub_name, BusStop.lat, BusStop.lng)
            .join(BusStop, BusStop.id == BusStopRoute.bus_stop_id)
            .where(BusStopRoute.bus_route_id.in_(route_ids))
        )
    ).all()
    stops_by_route: dict[int, list[BusRouteStop]] = {}
    for route_id, stop_id, name, sub_name, lat, lng in stop_rows:
        stops_by_route.setdefault(route_id, []).append(
            BusRouteStop(stop_id=stop_id, name=name, sub_name=sub_name, lat=float(lat), lng=float(lng))
        )

    data = [
        BusRouteSummary(
            route_id=r.id,
            route_number=r.route_number,
            route_name=r.route_name,
            direction_name=r.direction_name,
            category=r.category,
            is_realtime=r.is_realtime,
            gbis_route_id=r.gbis_route_id,
            stops=stops_by_route.get(r.id, []),
        )
        for r in routes
    ]
    await set_cached_json(cache_key, [d.model_dump() for d in data], ttl=_ROUTES_CACHE_TTL)
    return ApiResponse[list[BusRouteSummary]].ok(data)


@router.get("/stations")
@limiter.limit("30/minute")
async def bus_stations(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await get_stations(db)
    return ApiResponse[list[BusStationResponse]].ok(result)


@router.get("/arrivals/{station_id}")
@limiter.limit("60/minute")
async def bus_arrivals(
    request: Request,
    station_id: int,
    db: AsyncSession = Depends(get_db),
):
    # KST(UTC+9) 기준으로 현재 시각을 결정 — DB 시간표가 KST 기준으로 저장됨
    now = datetime.now(ZoneInfo("Asia/Seoul"))
    result = await get_arrivals(db, station_id, now.date(), now.time())
    if not result:
        return ApiResponse.fail("BUS_STATION_NOT_FOUND", "해당 정류장 ID가 존재하지 않습니다.")
    return ApiResponse[BusArrivalsResponse].ok(result)


@router.get("/timetable-by-route/{route_number}")
@limiter.limit("60/minute")
async def bus_timetable_by_route_number(
    request: Request,
    route_number: str,
    date_str: str | None = Query(None, alias="date"),
    stop_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        d = date.fromisoformat(date_str) if date_str else datetime.now(ZoneInfo("Asia/Seoul")).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식은 YYYY-MM-DD 이어야 합니다.")
    result = await get_timetable_by_route_number(db, route_number, d, stop_id=stop_id)
    if not result:
        return ApiResponse.fail("BUS_ROUTE_NOT_FOUND", f"'{route_number}' 노선을 찾을 수 없습니다.")
    return ApiResponse[BusTimetableResponse].ok(result)


@router.get("/timetable/{route_id}")
@limiter.limit("60/minute")
async def bus_timetable(
    request: Request,
    route_id: int,
    date_str: str | None = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
):
    try:
        d = date.fromisoformat(date_str) if date_str else datetime.now(ZoneInfo("Asia/Seoul")).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식은 YYYY-MM-DD 이어야 합니다.")
    result = await get_timetable(db, route_id, d)
    if not result:
        return ApiResponse.fail("BUS_ROUTE_NOT_FOUND", "해당 노선 ID가 존재하지 않습니다.")
    return ApiResponse[BusTimetableResponse].ok(result)


@router.get("/history-preview/{route_number}")
@limiter.limit("30/minute")
async def bus_history_preview(
    request: Request,
    route_number: str,
    db: AsyncSession = Depends(get_db),
):
    """실시간 노선 과거 도착 이력 조회 — 모달 예측 데이터용."""
    KST = ZoneInfo("Asia/Seoul")
    today = datetime.now(KST).date()

    wd = today.weekday()  # 0=Mon … 6=Sun
    WEEKDAY_KR = ["월", "화", "수", "목", "금", "토", "일"]

    def day_label(d: date) -> str:
        diff = (today - d).days
        name = WEEKDAY_KR[d.weekday()] + "요일"
        if diff == 1:
            return f"어제 ({name})"
        if diff <= 7:
            return f"저번 주 {name}"
        return f"2주전 {name}"

    # 임시방편: 평일에는 "저번 주 종합(수∪목)"과 "저번 주 금요일" 두 컬럼.
    # 주말은 기존 로직(저번 주 같은 요일 + 2주 전) 유지.
    target_dates: list[date] = []
    combined_dates: list[date] = []  # 종합 컬럼에 묶을 날짜들
    fri_date: date | None = None
    weekend_refs: list[tuple[str, date]] = []

    if wd <= 4:  # 평일
        days_to_last_wed = (wd - 2) % 7 or 7
        last_wed = today - timedelta(days=days_to_last_wed)
        last_thu = last_wed + timedelta(days=1)
        last_fri = last_wed + timedelta(days=2)
        combined_dates = [last_wed, last_thu]
        fri_date = last_fri
        target_dates = [last_wed, last_thu, last_fri]
    elif wd == 5:
        weekend_refs = [(day_label(today - timedelta(days=14)), today - timedelta(days=14)),
                        (day_label(today - timedelta(days=7)), today - timedelta(days=7))]
        target_dates = [d for _, d in weekend_refs]
    else:
        weekend_refs = [(day_label(today - timedelta(days=14)), today - timedelta(days=14)),
                        (day_label(today - timedelta(days=7)), today - timedelta(days=7))]
        target_dates = [d for _, d in weekend_refs]

    route_result = await db.execute(select(BusRoute).where(BusRoute.route_number == route_number))
    route = route_result.scalar_one_or_none()
    if not route:
        return ApiResponse.fail("BUS_ROUTE_NOT_FOUND", f"'{route_number}' 노선을 찾을 수 없습니다.")

    arrived_kst = func.timezone("Asia/Seoul", BusArrivalHistory.arrived_at)
    stmt = (
        select(
            func.date(arrived_kst).label("arr_date"),
            func.to_char(arrived_kst, "HH24:MI").label("arr_time"),
            BusStop.name.label("stop_name"),
        )
        .join(BusStop, BusStop.id == BusArrivalHistory.stop_id)
        .where(BusArrivalHistory.route_id == route.id)
        .where(func.date(arrived_kst).in_(target_dates))
        .order_by("arr_date", "arr_time")
    )
    rows = (await db.execute(stmt)).all()

    times_by_date: dict[str, list[str]] = {}
    stop_name: str | None = None
    for arr_date, arr_time, sname in rows:
        times_by_date.setdefault(str(arr_date), []).append(arr_time)
        if stop_name is None:
            stop_name = sname

    def dedupe_within(times: list[str], threshold_min: int) -> list[str]:
        """정렬된 HH:MM 리스트에서 직전 채택 시각과의 차이가 threshold 이하면 건너뜀."""
        kept: list[str] = []
        last_min: int | None = None
        for t in sorted(set(times)):
            h, m = t.split(":")
            cur = int(h) * 60 + int(m)
            if last_min is None or (cur - last_min) > threshold_min:
                kept.append(t)
                last_min = cur
        return kept

    if wd <= 4:
        combined_times = dedupe_within(
            [t for d in combined_dates for t in times_by_date.get(d.isoformat(), [])],
            threshold_min=5,
        )
        wed, thu = combined_dates
        columns = [
            {
                "label": "저번 주 종합",
                "date": wed.isoformat(),
                "day_label": f"{wed.month}/{wed.day}(수)·{thu.month}/{thu.day}(목)",
                "times": combined_times,
            },
            {
                "label": "저번 주 금요일",
                "date": fri_date.isoformat(),
                "day_label": f"{fri_date.month}/{fri_date.day}({WEEKDAY_KR[fri_date.weekday()]})",
                "times": times_by_date.get(fri_date.isoformat(), []),
            },
        ]
    else:
        columns = [
            {
                "label": label,
                "date": d.isoformat(),
                "day_label": f"{d.month}/{d.day}({WEEKDAY_KR[d.weekday()]})",
                "times": times_by_date.get(d.isoformat(), []),
            }
            for label, d in weekend_refs
        ]

    return ApiResponse.ok({
        "route_number": route_number,
        "stop_name": stop_name or "",
        "columns": columns,
    })


@router.get("/locations/{route_id}")
@limiter.limit("60/minute")
async def bus_locations(
    request: Request,
    route_id: int,
    db: AsyncSession = Depends(get_db),
):
    """실시간 버스 위치 조회 (Redis 캐시 30초, 미스 시 GBIS API 호출)."""
    stmt = select(BusRoute).where(BusRoute.id == route_id)
    result = await db.execute(stmt)
    route = result.scalar_one_or_none()
    if not route:
        return ApiResponse.fail("BUS_ROUTE_NOT_FOUND", "해당 노선 ID가 존재하지 않습니다.")
    if not route.gbis_route_id:
        return ApiResponse.fail("NOT_REALTIME", "실시간 위치를 지원하지 않는 노선입니다.")

    cache_key = f"bus:locations:{route.gbis_route_id}"

    # ── 캐시 조회 ────────────────────────────────────────────
    try:
        redis = await get_redis()
        cached = await redis.get(cache_key)
        if cached:
            return ApiResponse.ok({
                "route_id": route.id,
                "route_no": route.route_number,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "buses": json.loads(cached),
            })
    except Exception:
        pass

    # ── 캐시 미스: GBIS API 호출 ─────────────────────────────
    buses = await fetch_bus_locations(route.gbis_route_id)

    try:
        redis = await get_redis()
        await redis.setex(cache_key, _LOCATIONS_CACHE_TTL, json.dumps(buses, ensure_ascii=False))
    except Exception:
        pass

    return ApiResponse.ok({
        "route_id": route.id,
        "route_no": route.route_number,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "buses": buses,
    })
