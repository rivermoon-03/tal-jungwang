import json
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_redis
from app.core.database import get_db
from app.core.limiter import limiter
from app.models.bus import BusRoute, BusStop, BusStopRoute
from app.schemas.common import ApiResponse
from app.schemas.bus import (
    BusArrivalsResponse,
    BusRouteStop,
    BusRouteSummary,
    BusStationResponse,
    BusTimetableResponse,
)
from app.services.bus import get_arrivals, get_stations, get_timetable, get_timetable_by_route_number
from app.services.external.gbis import fetch_bus_locations

router = APIRouter(prefix="/api/v1/bus", tags=["bus"])

_LOCATIONS_CACHE_TTL = 30  # 초 — 버스 폴링 간격과 동일


@router.get("/routes")
async def bus_routes(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """노선 목록. category(등교/하교/기타) 필터 가능. 각 노선의 stops 포함."""
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
    return ApiResponse[list[BusRouteSummary]].ok(data)


@router.get("/stations")
async def bus_stations(
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
        d = date.fromisoformat(date_str) if date_str else date.today()
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
        d = date.fromisoformat(date_str) if date_str else date.today()
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식은 YYYY-MM-DD 이어야 합니다.")
    result = await get_timetable(db, route_id, d)
    if not result:
        return ApiResponse.fail("BUS_ROUTE_NOT_FOUND", "해당 노선 ID가 존재하지 않습니다.")
    return ApiResponse[BusTimetableResponse].ok(result)


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
