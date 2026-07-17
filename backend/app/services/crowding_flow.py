"""노선별 시간대 혼잡도 곡선 집계.

`bus_crowding_logs`에 쌓인 GBIS crowded1/crowded2 로그(1=여유, 2=보통, 3=혼잡, 4=매우혼잡)를
30분 버킷으로 묶어 평균 혼잡도를 계산한다.

TrafficFlow와 동일한 입력·출력 구조(hour/minute/points/sample_days)를 유지해
프론트 차트 컴포넌트를 비슷한 방식으로 렌더할 수 있게 한다.

조회 경로: `bus_crowding_stats` 사전집계 테이블을 우선 조회한다(캐시미스당
60일 원본 로그 스캔이던 것을 O(버킷수) 조회로 대체). 사전집계가 비어 있으면
(테이블 미존재/마이그레이션 미적용/첫 나이틀리 이전 등) 기존 원본-로그 집계로
자동 폴백해 엔드포인트가 죽지 않게 한다.
"""
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError, ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bus import BusCrowdingLog, BusRoute, BusStop

KST = ZoneInfo("Asia/Seoul")
logger = logging.getLogger(__name__)

# bucket = hour*2 + half(0|1) → hour/minute 로 역산
_PRECOMPUTED_SQL = """
SELECT bucket,
       SUM(avg_crowded * sample_size) / NULLIF(SUM(sample_size), 0) AS avg_crowded,
       SUM(sample_size)::int AS sample_size,
       MAX(sample_days)::int AS sample_days
FROM bus_crowding_stats
WHERE route_id = :r AND day_type = :d
GROUP BY bucket
ORDER BY bucket
"""


async def _resolve_stop_name(db: AsyncSession, route_id: int) -> str | None:
    """집계 대상 정류장명(수집 정류장은 노선당 하나)."""
    return (
        await db.execute(
            select(BusStop.name)
            .join(BusCrowdingLog, BusCrowdingLog.stop_id == BusStop.id)
            .where(BusCrowdingLog.route_id == route_id)
            .limit(1)
        )
    ).scalar()


async def _compute_from_precomputed(
    db: AsyncSession, route_id: int, day_type: str
) -> list[dict] | None:
    """`bus_crowding_stats` 조회. 테이블 미존재/쿼리 실패 시 None(폴백 신호)."""
    try:
        rows = (
            await db.execute(text(_PRECOMPUTED_SQL), {"r": route_id, "d": day_type})
        ).mappings().all()
    except (ProgrammingError, DBAPIError) as exc:
        # bus_crowding_stats 테이블이 아직 없는 배포 직후~마이그레이션 미적용 상태.
        # 트랜잭션이 실패 상태로 남으므로 롤백 후 원본-로그 폴백으로 넘어간다.
        logger.warning(
            "bus_crowding_stats query failed, falling back to raw log aggregation: %s", exc
        )
        await db.rollback()
        return None

    if not rows:
        return None

    return [
        {
            "hour": int(r["bucket"]) // 2,
            "minute": (int(r["bucket"]) % 2) * 30,
            "crowded": float(r["avg_crowded"]),
            "samples": int(r["sample_size"]),
            "days": int(r["sample_days"]),
        }
        for r in rows
    ]


async def _compute_from_raw_logs(
    db: AsyncSession,
    route_id: int,
    day_type: str,
    lookback_days: int,
) -> list[dict]:
    """`bus_crowding_logs` 원본에서 직접 60일치 집계 (사전집계 미존재 시 폴백)."""
    since = datetime.now(KST) - timedelta(days=lookback_days)

    ts_kst = func.timezone("Asia/Seoul", BusCrowdingLog.recorded_at)
    hour_expr = func.extract("hour", ts_kst)
    half_expr = func.floor(func.extract("minute", ts_kst) / 30.0) * 30
    dow_expr = func.extract("isodow", ts_kst)

    stmt = (
        select(
            hour_expr.label("h"),
            half_expr.label("m"),
            func.avg(BusCrowdingLog.crowded).label("avg_c"),
            func.count().label("samples"),
            func.count(func.distinct(func.date(ts_kst))).label("days"),
        )
        .where(BusCrowdingLog.route_id == route_id)
        .where(BusCrowdingLog.recorded_at >= since)
    )

    if day_type == "weekday":
        stmt = stmt.where(dow_expr <= 5)
    else:  # weekend
        stmt = stmt.where(dow_expr > 5)

    stmt = stmt.group_by("h", "m").order_by("h", "m")

    rows = (await db.execute(stmt)).all()

    return [
        {
            "hour": int(r.h),
            "minute": int(r.m),
            "crowded": float(r.avg_c),
            "samples": int(r.samples),
            "days": int(r.days),
        }
        for r in rows
    ]


async def compute_crowding_flow(
    db: AsyncSession,
    route_no: str,
    day_type: str = "weekday",
    lookback_days: int = 60,
) -> dict:
    """최근 `lookback_days`일간의 혼잡도를 30분 간격으로 집계.

    한 `route_number`가 여러 category(등교/하교)에 존재할 수 있으므로
    실시간 추적 대상(gbis_route_id 존재)만 집계 대상으로 한정한다.
    """
    route_row = (
        await db.execute(
            select(BusRoute)
            .where(BusRoute.route_number == route_no)
            .where(BusRoute.gbis_route_id.isnot(None))
        )
    ).scalars().first()

    if route_row is None:
        return {
            "route_no": route_no,
            "route_direction": None,
            "stop_name": None,
            "day_type": day_type,
            "sample_days": 0,
            "total_samples": 0,
            "points": [],
        }

    stop_name = await _resolve_stop_name(db, route_row.id)

    raw_points = None
    if lookback_days == 60:
        # 사전집계는 항상 60일 윈도우로 계산되므로, 호출자가 다른 lookback을
        # 요청한 경우(현재 API는 기본값만 사용)에는 원본 집계로 바로 간다.
        raw_points = await _compute_from_precomputed(db, route_row.id, day_type)

    if raw_points is None:
        raw_points = await _compute_from_raw_logs(db, route_row.id, day_type, lookback_days)

    points = [
        {
            "hour": p["hour"],
            "minute": p["minute"],
            "crowded": p["crowded"],
            "samples": p["samples"],
        }
        for p in raw_points
    ]
    sample_days = max((p["days"] for p in raw_points), default=0)
    total_samples = sum(p["samples"] for p in points)

    return {
        "route_no": route_no,
        "route_direction": route_row.direction_name,
        "stop_name": stop_name,
        "day_type": day_type,
        "sample_days": sample_days,
        "total_samples": total_samples,
        "points": points,
    }
