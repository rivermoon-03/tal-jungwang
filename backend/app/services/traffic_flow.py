"""마유로 24시간 혼잡도 곡선 집계.

최근 N일간의 TrafficHistory 레코드를 30분 버킷으로 묶어 평균 congestion을 계산한다.
데이터가 쌓이지 않은 초기에는 points가 비어있을 수 있다 (UI에서 빈 상태 처리).
"""
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.traffic import TrafficHistory

KST = ZoneInfo("Asia/Seoul")


async def compute_flow(
    db: AsyncSession,
    road_name: str = "마유로",
    day_type: str = "weekday",
    lookback_days: int = 60,
) -> dict:
    """최근 `lookback_days`일간의 혼잡도를 30분 간격으로 집계."""
    since = datetime.now(KST) - timedelta(days=lookback_days)

    # KST 기준 타임스탬프 표현식 — 서울 시간대로 변환 후 시/분 추출
    ts_kst = func.timezone("Asia/Seoul", TrafficHistory.collected_at)
    hour_expr = func.extract("hour", ts_kst)
    # 30분 버킷: floor(minute/30) * 30 → 0 or 30
    half_expr = func.floor(func.extract("minute", ts_kst) / 30.0) * 30
    # ISO day-of-week: 1=Mon ... 7=Sun
    dow_expr = func.extract("isodow", ts_kst)

    stmt = (
        select(
            hour_expr.label("h"),
            half_expr.label("m"),
            func.avg(TrafficHistory.congestion).label("avg_cong"),
            func.count(func.distinct(func.date(ts_kst))).label("days"),
        )
        .where(TrafficHistory.road_name == road_name)
        .where(TrafficHistory.collected_at >= since)
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
            "congestion": float(r.avg_cong),
        }
        for r in rows
    ]
    sample_days = max((int(r.days) for r in rows), default=0)

    return {
        "road_name": road_name,
        "day_type": day_type,
        "sample_days": sample_days,
        "points": points,
    }
