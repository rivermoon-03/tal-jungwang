import json
import logging
from datetime import date, datetime, time, timedelta, timezone
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.cache import get_cached_json, get_redis, set_cached_json
from app.models.bus import BusRoute, BusStop, BusStopRoute, BusTimetableEntry
from app.services.bus_stats import get_arrival_stats

_KST = ZoneInfo("Asia/Seoul")
logger = logging.getLogger(__name__)

# ── 보수 안전 마진 ────────────────────────────────────────────────────────
# 실시간 도착 표시값을 raw 대비 깎아서 "약간 일찍 도착하는 것처럼" 보이게 한다.
# raw에서 max(MIN, min(MAX, raw*RATIO))초를 차감.
SAFETY_RATIO = 0.20
SAFETY_MIN_SEC = 30
SAFETY_MAX_SEC = 150


def apply_safety_margin(raw_sec: int | None) -> int | None:
    """realtime arrive_in_seconds에 보수 마진 적용. None/0/음수는 통과.

    정책 결정은 docs/superpowers/specs/2026-05-14-bus-arrival-conservative-margin-design.md
    의 §3.3 참조 — 1주 운영 후 SAFETY_RATIO 조정 가능.
    """
    if raw_sec is None or raw_sec <= 0:
        return raw_sec
    raw_sec = int(raw_sec)
    margin = max(SAFETY_MIN_SEC, min(SAFETY_MAX_SEC, int(raw_sec * SAFETY_RATIO)))
    return max(0, raw_sec - margin)


def _day_type(d: date) -> str:
    wd = d.weekday()
    if wd < 5:
        return "weekday"
    if wd == 5:
        return "saturday"
    return "sunday"


async def _compute_avg_interval(
    db: AsyncSession,
    route_id: int,
    stop_id: int,
    day_type: str,
    hour: int,
) -> int | None:
    """현재 시각 ±120분 윈도우의 bus_timetable_entries 기반 평균 배차 간격(분).

    entries 수 < 3이면 None 반환 (통계적으로 불충분).
    결과는 Redis에 TTL 3600으로 캐시. None은 캐시하지 않음 (다음 갱신 때 재계산).
    """
    if hour < 0 or hour > 23:
        return None

    cache_key = f"bus:interval:{route_id}:{stop_id}:{day_type}:{hour}"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        # 캐시는 {"value": int} 형태로 저장; 과거 int 저장 케이스도 방어
        if isinstance(cached, dict):
            val = cached.get("value")
            if isinstance(val, int):
                return val
        elif isinstance(cached, int):
            return cached

    # ±120분 윈도우: (hour-2)시 00분 ~ (hour+2)시 59분
    # 자정 경계는 clamp (자정 이후 entries는 다음날 day_type이라 이 윈도우에서 제외)
    lower_hour = max(0, hour - 2)
    upper_hour = min(23, hour + 2)
    lower_bound = time(lower_hour, 0, 0)
    upper_bound = time(upper_hour, 59, 59)

    stmt = (
        select(BusTimetableEntry.departure_time)
        .where(
            BusTimetableEntry.route_id == route_id,
            BusTimetableEntry.stop_id == stop_id,
            BusTimetableEntry.day_type == day_type,
            BusTimetableEntry.departure_time >= lower_bound,
            BusTimetableEntry.departure_time <= upper_bound,
        )
        .order_by(BusTimetableEntry.departure_time)
    )
    result = await db.execute(stmt)
    times: list[time] = list(result.scalars().all())

    if len(times) < 3:
        return None

    # 인접 간격(분) 계산
    gaps: list[float] = []
    for i in range(len(times) - 1):
        t1 = times[i]
        t2 = times[i + 1]
        sec1 = t1.hour * 3600 + t1.minute * 60 + t1.second
        sec2 = t2.hour * 3600 + t2.minute * 60 + t2.second
        diff_sec = sec2 - sec1
        if diff_sec <= 0:
            continue
        gaps.append(diff_sec / 60.0)

    if not gaps:
        return None

    avg_minutes = round(sum(gaps) / len(gaps))
    if avg_minutes <= 0:
        return None

    # 핫패스: JSON wrap 없이 plain string 으로 저장. 읽기측 `_decode_interval_payload` 가
    # 구형(`{"value": int}`)과 신형(plain int) 모두 호환.
    try:
        redis = await get_redis()
        await redis.set(cache_key, str(avg_minutes), ex=3600)
    except Exception as exc:
        logger.warning("bus:interval set 실패 (%s): %s", cache_key, exc)
    return avg_minutes


def _decode_interval_payload(raw: str | None) -> int | None | object:
    """interval 캐시 payload를 decode. 미스(None) ↔ 캐시 hit 의 None을 구분하기 위해
    miss 시 `_MISS` 센티넬을 반환한다.
    """
    if raw is None:
        return _MISS
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return _MISS
    if isinstance(parsed, dict):
        val = parsed.get("value")
        return val if isinstance(val, int) else None
    if isinstance(parsed, int):
        return parsed
    return None


_MISS = object()


async def _resolve_avg_intervals(
    db: AsyncSession,
    route_ids: list[int],
    stop_id: int,
    day_type: str,
    hour: int,
) -> dict[int, int | None]:
    """여러 route 의 평균 배차 간격을 한 번의 MGET 으로 prefetch.

    캐시 미스는 `_compute_avg_interval`을 sequential 하게 호출(같은 AsyncSession 공유).
    """
    if not route_ids:
        return {}
    redis = await get_redis()
    keys = [f"bus:interval:{rid}:{stop_id}:{day_type}:{hour}" for rid in route_ids]
    try:
        raws = await redis.mget(*keys)
    except Exception as exc:
        logger.warning("bus:interval mget 실패: %s", exc)
        raws = [None] * len(keys)
    # 테스트용 AsyncMock 등 비표준 반환을 방어 — list/tuple 이 아니면 미스로 폴백.
    if not isinstance(raws, (list, tuple)) or len(raws) != len(keys):
        raws = [None] * len(keys)

    result: dict[int, int | None] = {}
    misses: list[int] = []
    for rid, raw in zip(route_ids, raws):
        decoded = _decode_interval_payload(raw)
        if decoded is _MISS:
            misses.append(rid)
        else:
            result[rid] = decoded  # type: ignore[assignment]

    for rid in misses:
        try:
            result[rid] = await _compute_avg_interval(db, rid, stop_id, day_type, hour)
        except Exception as exc:
            logger.warning(
                "avg_interval 계산 실패 (route %s, stop %s): %s", rid, stop_id, exc
            )
            result[rid] = None
    return result


async def _resolve_arrival_stats(
    db: AsyncSession,
    route_ids: list[int],
    stop_id: int,
    day_type: str,
    hour: int,
) -> dict[int, dict | None]:
    """여러 route 의 도착 통계를 한 번의 MGET 으로 prefetch. 미스는 sequential DB 조회."""
    if not route_ids:
        return {}
    redis = await get_redis()
    keys = [f"bus:stats:{rid}:{stop_id}:{day_type}:{hour}" for rid in route_ids]
    try:
        raws = await redis.mget(*keys)
    except Exception as exc:
        logger.warning("bus:stats mget 실패: %s", exc)
        raws = [None] * len(keys)
    if not isinstance(raws, (list, tuple)) or len(raws) != len(keys):
        raws = [None] * len(keys)

    result: dict[int, dict | None] = {}
    misses: list[int] = []
    for rid, raw in zip(route_ids, raws):
        if raw is None:
            misses.append(rid)
            continue
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError):
            misses.append(rid)
            continue
        # negative cache sentinel: {"sample_size": None}
        if isinstance(parsed, dict) and parsed.get("sample_size") is None:
            result[rid] = None
        else:
            result[rid] = parsed if isinstance(parsed, dict) else None

    for rid in misses:
        try:
            result[rid] = await get_arrival_stats(db, rid, stop_id, day_type, hour)
        except Exception as exc:
            logger.warning(
                "arrival_stats 조회 실패 (route %s, stop %s): %s", rid, stop_id, exc
            )
            result[rid] = None
    return result


async def get_stations(db: AsyncSession) -> list[dict]:
    cache_key = "bus:stations"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        return cached

    stmt = select(BusStop).options(selectinload(BusStop.routes)).order_by(BusStop.id)
    result = await db.execute(stmt)
    stops = result.scalars().all()

    data = [
        {
            "station_id": s.id,
            "name": s.name,
            "sub_name": s.sub_name,
            "lat": float(s.lat),
            "lng": float(s.lng),
            "routes": [
                {
                    "route_number": r.route_number,
                    "route_name": r.route_name,
                    "is_realtime": r.is_realtime,
                }
                for r in s.routes
            ],
        }
        for s in stops
    ]
    await set_cached_json(cache_key, data, ttl=3600)
    return data


# 정류장+연결 노선 메타 캐시 TTL(초). admin CRUD 시 invalidate_bus_meta가 즉시
# 무효화하므로, 이 TTL은 "무효화 누락 시 최대 stale 허용치"로만 작동한다.
STATION_META_TTL = 300


async def _fetch_station_meta(db: AsyncSession, station_id: int) -> dict | None:
    """station_id(먼저 gbis_station_id 외부 ID, 없으면 내부 PK)로 정류장+노선을 DB에서 조회해
    직렬화 가능한 최소 필드만 담은 dict로 반환한다."""
    # 정류장 조회 — 먼저 gbis_station_id(외부 ID)로, 없으면 내부 PK(id)로 매칭
    # 프론트엔드는 GBIS 정류장 ID(예: 224000639)를 그대로 전달하므로 외부 ID 우선.
    stmt = (
        select(BusStop)
        .where(BusStop.gbis_station_id == str(station_id))
        .options(selectinload(BusStop.routes))
    )
    result = await db.execute(stmt)
    stop = result.scalar_one_or_none()
    if not stop:
        stmt = (
            select(BusStop)
            .where(BusStop.id == station_id)
            .options(selectinload(BusStop.routes))
        )
        result = await db.execute(stmt)
        stop = result.scalar_one_or_none()
    if not stop:
        return None

    return {
        "id": stop.id,
        "name": stop.name,
        "gbis_station_id": stop.gbis_station_id,
        "lat": float(stop.lat),
        "lng": float(stop.lng),
        "routes": [
            {
                "id": r.id,
                "route_number": r.route_number,
                "direction_name": r.direction_name,
                "category": r.category,
                "gbis_route_id": r.gbis_route_id,
                "is_realtime": r.is_realtime,
            }
            for r in stop.routes
        ],
    }


def _station_meta_to_stop(meta: dict) -> SimpleNamespace:
    """캐시된 정류장 메타(dict)를 get_arrivals 나머지 로직이 기대하는 속성 접근 형태로 복원.
    ORM 객체 대신 SimpleNamespace를 써서 DB 재조회 없이 동일한 `stop.x`/`route.x` 접근을 지원."""
    stop = SimpleNamespace(
        id=meta["id"],
        name=meta["name"],
        gbis_station_id=meta["gbis_station_id"],
        lat=meta.get("lat"),
        lng=meta.get("lng"),
    )
    stop.routes = [
        SimpleNamespace(
            id=r["id"],
            route_number=r["route_number"],
            direction_name=r["direction_name"],
            category=r["category"],
            gbis_route_id=r["gbis_route_id"],
            is_realtime=r["is_realtime"],
        )
        for r in meta["routes"]
    ]
    return stop


async def _get_station_meta(db: AsyncSession, station_id: int) -> dict | None:
    """정류장+노선 메타를 cache-aside로 조회한다. 캐시 히트 시 DB 재조회 없음.

    키: bus:station_meta:{station_id} (station_id는 요청 시 넘어온 원본 값 —
    gbis_station_id 또는 내부 PK). TTL은 STATION_META_TTL. admin CRUD는
    invalidate_bus_meta로 즉시 무효화한다.
    """
    cache_key = f"bus:station_meta:{station_id}"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        return cached

    meta = await _fetch_station_meta(db, station_id)
    if meta is None:
        return None
    await set_cached_json(cache_key, meta, ttl=STATION_META_TTL)
    return meta


async def get_arrivals(
    db: AsyncSession, station_id: int, d: date, now_time: time
) -> dict | None:
    meta = await _get_station_meta(db, station_id)
    if meta is None:
        return None
    stop = _station_meta_to_stop(meta)

    # 내부 PK로 이후 쿼리를 수행 (시간표 JOIN 등은 stop.id 기준)
    station_id = stop.id

    day = _day_type(d)
    # now_time은 KST 기준으로 넘어오며, DB departure_time도 KST 기준
    # timezone 없이 naive datetime끼리 비교 (둘 다 KST)
    now_dt = datetime.combine(d, now_time)
    arrivals: list[dict] = []

    # ── 1. 실시간 노선: Redis 캐시에서 읽기 ─────────────────────────────────
    realtime_routes: list[BusRoute] = [r for r in stop.routes if r.is_realtime]

    if realtime_routes and stop.gbis_station_id:
        try:
            redis = await get_redis()
            cached = await redis.get(f"bus:arrivals:{station_id}")
            if cached:
                payload = json.loads(cached)

                # 구형(리스트) 형태와 신형(dict with cached_at) 모두 지원
                if isinstance(payload, list):
                    cached_arrivals = payload
                    elapsed_sec = 0
                else:
                    cached_arrivals = payload.get("arrivals", [])
                    try:
                        cached_at = datetime.fromisoformat(payload["cached_at"])
                        # cached_at은 KST aware datetime — 현재 시각과 비교
                        now_kst = datetime.now(_KST)
                        if cached_at.tzinfo is None:
                            cached_at = cached_at.replace(tzinfo=_KST)
                        elapsed_sec = max(0, int((now_kst - cached_at).total_seconds()))
                    except (KeyError, ValueError):
                        elapsed_sec = 0

                # 1) elapsed 보정 + 보수 안전 마진을 먼저 적용한다.
                for arrival in cached_arrivals:
                    if elapsed_sec > 0 and arrival.get("arrive_in_seconds") is not None:
                        arrival["arrive_in_seconds"] = max(
                            0, arrival["arrive_in_seconds"] - elapsed_sec
                        )
                    # ── 보수 안전 마진: realtime 항목에만 적용 ──
                    if (
                        arrival.get("arrival_type") == "realtime"
                        and arrival.get("arrive_in_seconds") is not None
                    ):
                        arrival["arrive_in_seconds"] = apply_safety_margin(
                            arrival["arrive_in_seconds"]
                        )

                # 2) 이번 응답의 unique route_id 수집 → interval/stats 캐시를 한 번의
                #    MGET 으로 prefetch. 미스만 DB 조회한다(AsyncSession 동시 사용 금지).
                interval_route_ids: list[int] = []
                stats_route_ids: list[int] = []
                seen_int: set[int] = set()
                seen_stats: set[int] = set()
                for arrival in cached_arrivals:
                    rid = arrival.get("route_id")
                    if not isinstance(rid, int):
                        continue
                    if rid not in seen_int:
                        seen_int.add(rid)
                        interval_route_ids.append(rid)
                    if (
                        arrival.get("arrival_type") == "realtime"
                        and rid not in seen_stats
                    ):
                        seen_stats.add(rid)
                        stats_route_ids.append(rid)

                interval_cache = await _resolve_avg_intervals(
                    db, interval_route_ids, stop.id, day, now_time.hour
                )
                stats_cache = await _resolve_arrival_stats(
                    db, stats_route_ids, stop.id, day, now_time.hour
                )

                # 3) 결과 머지.
                for arrival in cached_arrivals:
                    rid = arrival.get("route_id")
                    if not isinstance(rid, int):
                        continue
                    avg = interval_cache.get(rid)
                    if avg is not None:
                        arrival["avg_interval_minutes"] = avg
                    if arrival.get("arrival_type") == "realtime":
                        stats_payload = stats_cache.get(rid)
                        if stats_payload is not None:
                            arrival["stats"] = stats_payload
                arrivals.extend(cached_arrivals)
        except Exception as exc:
            logger.warning("Redis 캐시 읽기 실패 (정류장 %s): %s", station_id, exc)

    # ── 1-1. GBIS 캐시에 없는 실시간 노선 → null placeholder ─────────────────
    # gbis_station_id가 없는 정류장은 실시간 조회 자체가 불가하므로 placeholder를 추가하지
    # 않고 시간표 쿼리로 넘긴다 (stop.gbis_station_id가 있을 때만 placeholder 적용).
    if stop.gbis_station_id:
        seen_realtime_ids: set[int] = {a["route_id"] for a in arrivals}
        for route in realtime_routes:
            if route.id not in seen_realtime_ids:
                arrivals.append({
                    "route_id": route.id,
                    "route_no": route.route_number,
                    "destination": route.direction_name,
                    "category": route.category,
                    "arrival_type": "realtime",
                    "depart_at": None,
                    "arrive_in_seconds": None,
                    "is_tomorrow": False,
                })

    # ── 2. 시간표 기반 노선: DB 조회 ───────────────────────────────────────
    # gbis_station_id 없는 정류장에서는 gbis_route_id를 가진 노선도 시간표로 조회한다.
    realtime_route_ids: set[int] = (
        {r.id for r in realtime_routes} if stop.gbis_station_id else set()
    )
    # 오늘 시간표 소진 판단 범위: gbis 없는 정류장은 모든 노선을 시간표 대상으로 간주
    timetable_route_ids: set[int] = (
        {r.id for r in stop.routes if not r.is_realtime}
        if stop.gbis_station_id
        else {r.id for r in stop.routes}
    )

    stmt = (
        select(BusTimetableEntry, BusRoute)
        .join(BusRoute, BusTimetableEntry.route_id == BusRoute.id)
        .where(
            BusTimetableEntry.stop_id == station_id,
            BusTimetableEntry.day_type == day,
            BusTimetableEntry.departure_time > now_time,
            # 실시간 노선은 시간표 중복 출력 방지
            BusRoute.id.not_in(realtime_route_ids) if realtime_route_ids else True,
        )
        .order_by(BusTimetableEntry.departure_time)
    )
    result = await db.execute(stmt)
    rows = result.all()

    seen_timetable_routes: set[int] = set()

    for entry, route in rows:
        if route.id in seen_timetable_routes:
            continue
        seen_timetable_routes.add(route.id)

        depart_dt = datetime.combine(d, entry.departure_time)
        diff = int((depart_dt - now_dt).total_seconds())

        arrivals.append({
            "route_id": route.id,
            "route_no": route.route_number,
            "destination": route.direction_name,
            "category": route.category,
            "arrival_type": "timetable",
            "depart_at": entry.departure_time.strftime("%H:%M"),
            "arrive_in_seconds": diff,
            "is_tomorrow": False,
        })

    # ── 2-1. 오늘 시간표 소진된 시간표 기반 노선 → 내일 첫차 조회 ────────────
    exhausted_route_ids = timetable_route_ids - seen_timetable_routes - realtime_route_ids
    if exhausted_route_ids:
        tomorrow = d + timedelta(days=1)
        tomorrow_day = _day_type(tomorrow)

        stmt_tmr = (
            select(BusTimetableEntry, BusRoute)
            .join(BusRoute, BusTimetableEntry.route_id == BusRoute.id)
            .where(
                BusTimetableEntry.stop_id == station_id,
                BusTimetableEntry.day_type == tomorrow_day,
                BusRoute.id.in_(exhausted_route_ids),
            )
            .order_by(BusTimetableEntry.route_id, BusTimetableEntry.departure_time)
        )
        result_tmr = await db.execute(stmt_tmr)
        rows_tmr = result_tmr.all()

        # 초 단위 자정까지 남은 시간
        seconds_to_midnight = (
            86400
            - now_time.hour * 3600
            - now_time.minute * 60
            - now_time.second
        )

        seen_tomorrow_routes: set[int] = set()
        for entry, route in rows_tmr:
            if route.id in seen_tomorrow_routes:
                continue
            seen_tomorrow_routes.add(route.id)

            dep = entry.departure_time
            dep_seconds = dep.hour * 3600 + dep.minute * 60 + dep.second
            arrive_in_seconds = seconds_to_midnight + dep_seconds

            arrivals.append({
                "route_id": route.id,
                "route_no": route.route_number,
                "destination": route.direction_name,
                "category": route.category,
                "arrival_type": "timetable",
                "depart_at": entry.departure_time.strftime("%H:%M"),
                "arrive_in_seconds": arrive_in_seconds,
                "is_tomorrow": True,
            })

    # ── 3. 정렬: arrive_in_seconds 기준 오름차순 (None은 뒤로) ─────────────
    arrivals.sort(key=lambda x: (x["arrive_in_seconds"] is None, x["arrive_in_seconds"] or 0))

    return {
        "station_id": station_id,
        "station_name": stop.name,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "arrivals": arrivals,
    }


async def get_timetable_by_route_number(
    db: AsyncSession,
    route_number: str,
    d: date,
    *,
    stop_id: int | None = None,
    category: str | None = None,
    day_type: str | None = None,
) -> dict | None:
    """route_number(예: "3400") 문자열로 조회. ID를 모를 때 사용.
    같은 route_number에 여러 row가 있을 때(양방향 분리):
    1. category(등교/하교)가 주어지면 해당 category의 route를 우선 선택.
    2. stop_id로 실제 시간표가 있는 row를 찾아 사용.
    3. 아무 조건도 없거나 단일 row면 is_realtime=True 우선, 그 다음 id 오름차순 첫 번째 row를 사용한다.
       (혼합 노선: 등교=실시간/하교=시간표 시 category 미지정이면 실시간 방향을 기본 반환)"""
    # category 미지정 시 is_realtime=True(gbis_route_id IS NOT NULL) 우선 정렬.
    # is_realtime은 Python property라 DB 정렬 불가 — gbis_route_id NULL 여부로 대체.
    stmt = (
        select(BusRoute)
        .where(BusRoute.route_number == route_number)
        .order_by(BusRoute.gbis_route_id.desc().nullslast(), BusRoute.id)
    )
    result = await db.execute(stmt)
    routes = result.scalars().all()
    if not routes:
        return None

    # category로 route 필터링 (등교/하교)
    if category and len(routes) > 1:
        matched = [r for r in routes if r.category == category]
        if matched:
            return await get_timetable(
                db, matched[0].id, d, stop_id=stop_id, day_type=day_type
            )

    if stop_id is not None and len(routes) > 1:
        # 여러 row 중 해당 stop에 실제 시간표 데이터가 있는 row를 우선 선택
        day = day_type or _day_type(d)
        for route in routes:
            check_stmt = (
                select(BusTimetableEntry.id)
                .where(
                    BusTimetableEntry.route_id == route.id,
                    BusTimetableEntry.stop_id == stop_id,
                    BusTimetableEntry.day_type == day,
                )
                .limit(1)
            )
            exists = (await db.execute(check_stmt)).scalar_one_or_none()
            if exists is not None:
                return await get_timetable(
                    db, route.id, d, stop_id=stop_id, day_type=day_type
                )

    return await get_timetable(
        db, routes[0].id, d, stop_id=stop_id, day_type=day_type
    )


async def get_timetable(
    db: AsyncSession,
    route_id: int,
    d: date,
    *,
    stop_id: int | None = None,
    day_type: str | None = None,
) -> dict | None:
    # day_type 명시 시(요일 탭 선택 등) 날짜보다 우선 — 프론트가 평일에 토/일 탭을
    # 눌러도 해당 요일 시간표를 조회하도록 한다.
    day = day_type or _day_type(d)
    cache_key = f"bus:timetable:{route_id}:{day}:{stop_id if stop_id is not None else 'all'}"
    cached = await get_cached_json(cache_key)
    if cached is not None:
        return cached

    stmt = select(BusRoute).where(BusRoute.id == route_id)
    result = await db.execute(stmt)
    route = result.scalar_one_or_none()
    if not route:
        return None

    stmt = (
        select(BusTimetableEntry)
        .where(
            BusTimetableEntry.route_id == route_id,
            BusTimetableEntry.day_type == day,
        )
        .order_by(BusTimetableEntry.departure_time)
    )
    if stop_id is not None:
        stmt = stmt.where(BusTimetableEntry.stop_id == stop_id)
    result = await db.execute(stmt)
    entries = result.scalars().all()

    stop_name: str | None = None
    if stop_id is not None:
        stop = await db.get(BusStop, stop_id)
        stop_name = stop.name if stop else None

    # 기점 출발 정류장: bus_stop_routes에서 해당 route에 연결된 첫 번째 stop
    origin_stop_name: str | None = None
    origin_stmt = (
        select(BusStop.name)
        .join(BusStopRoute, BusStopRoute.bus_stop_id == BusStop.id)
        .where(BusStopRoute.bus_route_id == route_id)
        .order_by(BusStop.id)
        .limit(1)
    )
    origin_result = await db.execute(origin_stmt)
    origin_stop_name = origin_result.scalar_one_or_none()

    data = {
        "route_id": route.id,
        "route_name": route.route_name or route.route_number,
        "schedule_type": day,
        "stop_id": stop_id,
        "stop_name": stop_name,
        "times": [e.departure_time.strftime("%H:%M") for e in entries],
        "notes": [e.note for e in entries],
        "direction_name": route.direction_name,
        "category": route.category,
        "origin_stop_name": origin_stop_name,
        "is_realtime": route.is_realtime,
        "gbis_route_id": route.gbis_route_id,
    }
    await set_cached_json(cache_key, data, ttl=86400)
    return data


async def invalidate_bus_meta(route_id: int | None = None) -> None:
    """admin CRUD 후 호출 — bus 메타 캐시(stations·routes·timetable)을 무효화한다.

    `route_id` 가 주어지면 해당 노선의 timetable 만 SCAN+UNLINK 로 묶어서 제거.
    None 이면 전체 timetable 무효화. routes/stations 는 키가 적어 직접 삭제.
    """
    try:
        redis = await get_redis()
    except Exception as exc:
        logger.warning("bus 캐시 무효화 실패 (redis 연결): %s", exc)
        return

    try:
        await redis.delete("bus:stations")
        # bus:routes:{category|'all'} — 보통 4개 미만이라 SCAN+UNLINK
        batch: list[str] = []
        async for key in redis.scan_iter(match="bus:routes:*", count=200):
            batch.append(key)
            if len(batch) >= 200:
                await redis.unlink(*batch)
                batch.clear()
        if batch:
            await redis.unlink(*batch)
            batch.clear()

        # bus:station_meta:{station_id} — get_arrivals 핫패스 캐시. 정류장/노선
        # 수정 시 stale 방지를 위해 bus:stations와 함께 무효화한다.
        async for key in redis.scan_iter(match="bus:station_meta:*", count=200):
            batch.append(key)
            if len(batch) >= 200:
                await redis.unlink(*batch)
                batch.clear()
        if batch:
            await redis.unlink(*batch)
            batch.clear()

        # bus:timetable:{route_id}:{day}:{stop_id|'all'} — 24h TTL 이므로
        # CRUD 후 stale 가능성이 크다.
        match = f"bus:timetable:{route_id}:*" if route_id is not None else "bus:timetable:*"
        async for key in redis.scan_iter(match=match, count=500):
            batch.append(key)
            if len(batch) >= 500:
                await redis.unlink(*batch)
                batch.clear()
        if batch:
            await redis.unlink(*batch)
    except Exception as exc:
        logger.warning("bus 캐시 무효화 실패 (스캔/삭제): %s", exc)
