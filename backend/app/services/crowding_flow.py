"""노선별 시간대 혼잡도 곡선 집계.

`bus_crowding_logs`에 쌓인 GBIS crowded1/crowded2 로그(1=여유, 2=보통, 3=혼잡, 4=매우혼잡)를
30분 버킷으로 묶어 평균 혼잡도를 계산한다.

TrafficFlow와 동일한 입력·출력 구조(hour/minute/points/sample_days)를 유지해
프론트 차트 컴포넌트를 비슷한 방식으로 렌더할 수 있게 한다.
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bus import BusCrowdingLog, BusRoute, BusStop

KST = ZoneInfo("Asia/Seoul")


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

    since = datetime.now(KST) - timedelta(days=lookback_days)

    ts_kst = func.timezone("Asia/Seoul", BusCrowdingLog.recorded_at)
    hour_expr = func.extract("hour", ts_kst)
    half_expr = func.floor(func.extract("minute", ts_kst) / 30.0) * 30
    dow_expr = func.extract("isodow", ts_kst)

    # 집계 대상 정류장명(수집 정류장은 노선당 하나)
    stop_name = (
        await db.execute(
            select(BusStop.name)
            .join(BusCrowdingLog, BusCrowdingLog.stop_id == BusStop.id)
            .where(BusCrowdingLog.route_id == route_row.id)
            .limit(1)
        )
    ).scalar()

    stmt = (
        select(
            hour_expr.label("h"),
            half_expr.label("m"),
            func.avg(BusCrowdingLog.crowded).label("avg_c"),
            func.count().label("samples"),
            func.count(func.distinct(func.date(ts_kst))).label("days"),
        )
        .where(BusCrowdingLog.route_id == route_row.id)
        .where(BusCrowdingLog.recorded_at >= since)
    )

    if day_type == "weekday":
        stmt = stmt.where(dow_expr <= 5)
    else:  # weekend
        stmt = stmt.where(dow_expr > 5)

    stmt = stmt.group_by("h", "m").order_by("h", "m")

    rows = (await db.execute(stmt)).all()

    points = [
        {
            "hour": int(r.h),
            "minute": int(r.m),
            "crowded": float(r.avg_c),
            "samples": int(r.samples),
        }
        for r in rows
    ]
    sample_days = max((int(r.days) for r in rows), default=0)
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
