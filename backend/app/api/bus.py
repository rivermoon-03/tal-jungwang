import json
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
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
from app.schemas.traffic import CrowdingFlowResponse
from app.core.cache import get_cached_json, set_cached_json
from app.services.bus import get_arrivals, get_stations, get_timetable, get_timetable_by_route_number
from app.services.crowding_flow import compute_crowding_flow
from app.services.external.gbis import fetch_bus_locations

router = APIRouter(prefix="/api/v1/bus", tags=["bus"])

_LOCATIONS_CACHE_TTL = 30  # 초 — 버스 폴링 간격과 동일
_ROUTES_CACHE_TTL = 3600   # 노선 목록은 정적 데이터 — 1시간 캐시


@router.get("/routes")
@limiter.limit("30/minute")
async def bus_routes(
    request: Request,
    response: Response,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """노선 목록. category(등교/하교/기타) 필터 가능. 각 노선의 stops 포함."""
    response.headers["Cache-Control"] = "public, max-age=600, stale-while-revalidate=3600"
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
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await get_stations(db)
    response.headers["Cache-Control"] = "public, max-age=600, stale-while-revalidate=3600"
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
    response: Response,
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
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
    return ApiResponse[BusTimetableResponse].ok(result)


@router.get("/timetable/{route_id}")
@limiter.limit("60/minute")
async def bus_timetable(
    request: Request,
    response: Response,
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
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
    return ApiResponse[BusTimetableResponse].ok(result)


_HISTORY_PREVIEW_CACHE_TTL = 30  # 초 — realtime_eta 포함, 짧은 캐시로 시트 재오픈 보호


async def _compute_realtime_eta(
    db: AsyncSession,
    route_ids: list[int],
    stop_id: int | str | None,
    now_kst: datetime,
) -> dict | None:
    """`bus:arrivals:{stop_id}` 캐시 기반으로 (route_id IN route_ids) 도착 정보 추출.

    arrive_in_seconds > 0 인 항목 최대 2건을 시간 오름차순으로 반환.
    0건이면 None.

    stop_id는 GBIS station id 문자열 또는 internal PK 정수 모두 허용
    (get_arrivals 내부에서 두 경로 모두 처리).
    """
    if stop_id is None or not route_ids:
        return None
    try:
        result = await get_arrivals(db, stop_id, now_kst.date(), now_kst.time())
    except Exception:
        return None
    if not result:
        return None
    arrivals = result.get("arrivals", []) or []
    route_id_set = set(route_ids)
    filtered = [
        a for a in arrivals
        if a.get("route_id") in route_id_set
        and isinstance(a.get("arrive_in_seconds"), int)
        and a["arrive_in_seconds"] > 0
    ]
    if not filtered:
        return None
    filtered.sort(key=lambda a: a["arrive_in_seconds"])
    top = filtered[:2]

    def _entry(sec: int) -> dict:
        arrive_at = now_kst + timedelta(seconds=sec)
        return {
            "arrive_in_seconds": sec,
            "arrive_at_hhmm": arrive_at.strftime("%H:%M"),
        }

    out: dict = {"primary": _entry(top[0]["arrive_in_seconds"])}
    if len(top) >= 2:
        out["secondary"] = _entry(top[1]["arrive_in_seconds"])
    else:
        out["secondary"] = None
    return out


def _compute_predicted_eta(
    columns: list[dict],
    now_kst: datetime,
) -> dict | None:
    """이미 dedupe된 columns 데이터에서 현재 시각 이후 첫 도착 시각의 중앙값.

    화면에 표시되는 컬럼과 동일 데이터를 사용해 display ↔ prediction이 항상 일치.
    raw bus_arrival_history는 동일 차량의 중복 폴링·양방향 route_id가 섞여 있을 수 있어,
    dedupe된 표시 데이터가 사용자 신뢰와 가장 잘 맞는다.

    매칭 ≥ 2건이면 dict, 미만이면 None.
    """
    now_hhmm = now_kst.strftime("%H:%M")
    firsts_min: list[int] = []
    for col in columns:
        for t in col.get("times") or []:
            if t > now_hhmm:
                h, m = t.split(":")
                firsts_min.append(int(h) * 60 + int(m))
                break
    if len(firsts_min) < 2:
        return None

    firsts_min.sort()
    n = len(firsts_min)
    mid = n // 2
    if n % 2 == 1:
        median_min = firsts_min[mid]
    else:
        median_min = (firsts_min[mid - 1] + firsts_min[mid]) // 2

    hh, mm = divmod(median_min, 60)
    wd = now_kst.weekday()
    day_label = "평일" if wd <= 4 else "주말"

    return {
        "hhmm": f"{hh:02d}:{mm:02d}",
        "sample_size": n,
        "day_label": day_label,
    }


@router.get("/history-preview/{route_number}")
@limiter.limit("30/minute")
async def bus_history_preview(
    request: Request,
    route_number: str,
    stop_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """실시간 노선 과거 도착 이력 조회 — 모달 예측 데이터용.

    오늘 요일 타입에 따라 고정 날짜를 반환:
    - 평일: 어제, 이틀 전, 저번 주 금요일
    - 토요일: 저번 주 토/일, 저저번 주 토/일
    - 일요일: 저번 주 일/토, 저저번 주 토/일
    데이터가 없는 날짜도 빈 컬럼으로 포함.

    응답에 `realtime_eta`(GBIS 캐시 기반 1~2건)와 `predicted_eta`(과거 이력 median)
    필드를 포함한다. realtime_eta가 있으면 predicted_eta는 항상 null.

    `stop_id` 쿼리: 카드가 보는 GBIS 추적 정류장(gbis_station_id 또는 internal PK).
    주어지면 realtime_eta 계산에 우선 사용 — 카드와 모달이 같은 정류장 ETA를 보게 한다.
    """
    # stop_id는 GBIS station id 문자열로 올 수 있어 캐시 키에 그대로 포함
    cache_key = f"bus:history_preview:{route_number}:{stop_id or 'auto'}"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        return ApiResponse.ok(cached)

    KST = ZoneInfo("Asia/Seoul")
    today = datetime.now(KST).date()

    wd = today.weekday()  # 0=Mon … 6=Sun
    WEEKDAY_KR = ["월", "화", "수", "목", "금", "토", "일"]

    if wd <= 4:  # 평일
        yesterday = today - timedelta(days=1)
        two_days_ago = today - timedelta(days=2)
        days_back_friday = (wd - 4) % 7 or 7
        last_friday = today - timedelta(days=days_back_friday)
        target_dates_labeled: list[tuple[date, str]] = [
            (yesterday, "어제"),
            (two_days_ago, "이틀 전"),
            (last_friday, "저번 주 금요일"),
        ]
    elif wd == 5:  # 토요일
        target_dates_labeled = [
            (today - timedelta(days=7), "저번 주 토요일"),
            (today - timedelta(days=6), "저번 주 일요일"),
            (today - timedelta(days=14), "저저번 주 토요일"),
            (today - timedelta(days=13), "저저번 주 일요일"),
        ]
    else:  # 일요일
        target_dates_labeled = [
            (today - timedelta(days=7), "저번 주 일요일"),
            (today - timedelta(days=8), "저번 주 토요일"),
            (today - timedelta(days=14), "저저번 주 일요일"),
            (today - timedelta(days=15), "저저번 주 토요일"),
        ]

    target_dates = [d for d, _ in target_dates_labeled]
    label_map: dict[str, str] = {d.isoformat(): lbl for d, lbl in target_dates_labeled}

    routes_result = await db.execute(select(BusRoute).where(BusRoute.route_number == route_number))
    routes = routes_result.scalars().all()
    if not routes:
        return ApiResponse.fail("BUS_ROUTE_NOT_FOUND", f"'{route_number}' 노선을 찾을 수 없습니다.")
    route_ids = [r.id for r in routes]

    arrived_kst = func.timezone("Asia/Seoul", BusArrivalHistory.arrived_at)

    stmt = (
        select(
            func.date(arrived_kst).label("arr_date"),
            func.to_char(arrived_kst, "HH24:MI").label("arr_time"),
            BusStop.name.label("stop_name"),
        )
        .join(BusStop, BusStop.id == BusArrivalHistory.stop_id)
        .where(BusArrivalHistory.route_id.in_(route_ids))
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

    def dedupe_within(times: list[str], threshold_min: int = 3) -> list[str]:
        kept: list[str] = []
        last_min: int | None = None
        for t in sorted(set(times)):
            h, m = t.split(":")
            cur = int(h) * 60 + int(m)
            if last_min is None or (cur - last_min) > threshold_min:
                kept.append(t)
                last_min = cur
        return kept

    columns = [
        {
            "label": label_map[d.isoformat()],
            "date": d.isoformat(),
            "day_label": f"{d.month}/{d.day}({WEEKDAY_KR[d.weekday()]})",
            "times": dedupe_within(times_by_date.get(d.isoformat(), [])),
            "totalCount": len(times_by_date.get(d.isoformat(), [])),
        }
        for d in target_dates
    ]

    # 통계 조회용 primary (route_id, stop_id) — 매칭 routes 중 첫 번째 + 이 노선군에서
    # 같은 target_dates 윈도우 안에 가장 빈도 높은 stop_id (단일 정류장 통계 단위).
    primary_route_id = route_ids[0] if route_ids else None
    primary_stop_id: int | None = None
    if route_ids and rows:
        sid_stmt = (
            select(BusArrivalHistory.stop_id, func.count().label("c"))
            .where(BusArrivalHistory.route_id.in_(route_ids))
            .where(func.date(arrived_kst).in_(target_dates))
            .group_by(BusArrivalHistory.stop_id)
            .order_by(func.count().desc())
            .limit(1)
        )
        sid_row = (await db.execute(sid_stmt)).first()
        if sid_row is not None:
            primary_stop_id = sid_row[0]

    # ── realtime_eta / predicted_eta 산출 ──────────────────────────────────
    now_kst = datetime.now(KST)
    # 카드와 모달이 같은 정류장 ETA를 보도록, 명시된 stop_id(GBIS 추적 정류장)를 우선 사용.
    # 미전달 시 fallback으로 history 빈도 기반 primary_stop_id 사용.
    realtime_stop = stop_id if stop_id is not None else primary_stop_id
    realtime_eta = await _compute_realtime_eta(db, route_ids, realtime_stop, now_kst)
    predicted_eta = None
    if realtime_eta is None:
        predicted_eta = _compute_predicted_eta(columns, now_kst)

    payload = {
        "route_number": route_number,
        "route_id": primary_route_id,
        "stop_id": primary_stop_id,
        "stop_name": stop_name or "",
        "columns": columns,
        "realtime_eta": realtime_eta,
        "predicted_eta": predicted_eta,
    }
    await set_cached_json(cache_key, payload, ttl=_HISTORY_PREVIEW_CACHE_TTL)
    return ApiResponse.ok(payload)


@router.get("/arrival-stats/{route_id}/{stop_id}")
@limiter.limit("60/minute")
async def bus_arrival_stats_lookup(
    request: Request,
    route_id: int,
    stop_id: int,
    hour: int | None = Query(None, ge=0, le=23),
    day_type: str | None = Query(None, pattern="^(weekday|saturday|sunday)$"),
    db: AsyncSession = Depends(get_db),
):
    """특정 (route_id, stop_id) 페어의 이 시간대 도착 분포 통계.

    hour/day_type 미지정 시 현재 KST 시각·요일에서 도출.
    데이터 없으면 stats=None (200).
    """
    from app.services.bus_stats import get_arrival_stats

    KST = ZoneInfo("Asia/Seoul")
    now = datetime.now(KST)
    resolved_hour = hour if hour is not None else now.hour
    if day_type is None:
        wd = now.weekday()
        resolved_day = "weekday" if wd <= 4 else ("saturday" if wd == 5 else "sunday")
    else:
        resolved_day = day_type

    stats = await get_arrival_stats(db, route_id, stop_id, resolved_day, resolved_hour)

    return ApiResponse.ok({
        "route_id": route_id,
        "stop_id": stop_id,
        "day_type": resolved_day,
        "hour_of_day": resolved_hour,
        "stats": stats,
    })


_CROWDING_FLOW_CACHE_TTL = 1800  # 30분 — 혼잡도 누적은 천천히 바뀜


@router.get("/crowding/{route_number}")
@limiter.limit("30/minute")
async def bus_crowding_flow(
    request: Request,
    route_number: str,
    day_type: str = Query("weekday", pattern="^(weekday|weekend)$"),
    db: AsyncSession = Depends(get_db),
):
    """노선별 24시간 혼잡도 곡선 (30분 버킷, 최근 60일 평균).

    GBIS crowded1/crowded2 필드(1~4)를 bus_crowding_logs에서 집계한다.
    실시간 추적 노선(gbis_route_id 존재)만 데이터가 쌓인다.
    """
    cache_key = f"crowding:flow:{route_number}:{day_type}"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        return ApiResponse[CrowdingFlowResponse].ok(cached)

    data = await compute_crowding_flow(db, route_no=route_number, day_type=day_type)
    await set_cached_json(cache_key, data, ttl=_CROWDING_FLOW_CACHE_TTL)
    return ApiResponse[CrowdingFlowResponse].ok(data)


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
