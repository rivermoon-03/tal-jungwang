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
from app.services.crowding_calibration import load_calibrations

KST = ZoneInfo("Asia/Seoul")
logger = logging.getLogger(__name__)

# bucket = hour*2 + half(0|1) → hour/minute 로 역산
_PRECOMPUTED_SQL = """
SELECT bucket,
       SUM(avg_crowded * sample_size) / NULLIF(SUM(sample_size), 0) AS avg_crowded,
       SUM(sample_size)::int AS sample_size,
       MAX(sample_days)::int AS sample_days,
       SUM(c1)::int AS c1,
       SUM(c2)::int AS c2,
       SUM(c3)::int AS c3,
       SUM(c4)::int AS c4
FROM bus_crowding_stats
WHERE route_id = :r AND day_type = :d
GROUP BY bucket
ORDER BY bucket
"""

# 표본이 이보다 적은 버킷은 비율의 분산이 커서 등급을 단정하면 오해를 만든다.
# 값은 그대로 내보내되 프런트가 "정보 부족"으로 표시한다.
MIN_RELIABLE_SAMPLES = 10


def build_points(
    rows,
    *,
    rules=None,
    route_id: int | None = None,
    stop_id: int | None = None,
    day_type: str | None = None,
) -> list[dict]:
    """사전집계 행 → 화면이 쓰는 point 목록.

    `ratio` = 이 버킷 도착 버스 중 혼잡(등급 3 이상) 비율. 평균 대신 이 값을 표시
    기준으로 쓴다 — 평균은 하한이 1이라 값 1인 버스와 3인 버스가 섞이면 2("보통")가
    되어 실제로 존재한 어떤 버스도 설명하지 못한다.

    `c1..c4` 가 없는 행(마이그레이션 직후~첫 나이틀리 이전)은 `ratio=None` 이다.
    평균으로 대체 추정하지 않는다 — 그게 지금 고치는 문제의 원인이다.
    """
    from app.services.crowding_calibration import apply_calibration

    rules = rules or []
    points: list[dict] = []
    for row in rows:
        bucket = int(row["bucket"])
        counts = [row.get(k) for k in ("c1", "c2", "c3", "c4")]
        has_distribution = all(c is not None for c in counts)
        hour = bucket // 2

        ratio: float | None = None
        estimated = False
        samples = 0
        if has_distribution:
            c1, c2, c3, c4 = (int(c) for c in counts)
            samples = c1 + c2 + c3 + c4
            if samples > 0:
                ratio = (c3 + c4) / samples
                # 보정은 등급 축에서 이뤄진다. 하한이 3 이상이면 이 시간대 도착 버스를
                # 전부 혼잡으로 본다는 뜻이므로 비율이 1.0 이 된다.
                observed_level = 4 if c4 > c3 and c4 > c2 and c4 > c1 else (
                    3 if ratio >= 0.5 else (2 if (c2 + c3 + c4) / samples >= 0.5 else 1)
                )
                level, estimated = apply_calibration(
                    observed_level,
                    rules,
                    route_id=route_id,
                    stop_id=stop_id,
                    day_type=day_type,
                    hour=hour,
                )
                if estimated and level is not None and level >= 3:
                    ratio = 1.0

        points.append({
            "hour": hour,
            "minute": (bucket % 2) * 30,
            "crowded": float(row["avg_crowded"]) if row.get("avg_crowded") is not None else None,
            "ratio": ratio,
            "samples": samples,
            "estimated": estimated,
            "reliable": samples >= MIN_RELIABLE_SAMPLES,
            "days": int(row["sample_days"]) if row.get("sample_days") is not None else 0,
        })
    return points


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


async def _resolve_stop_id(db: AsyncSession, route_id: int) -> int | None:
    """보정 규칙 매칭에 쓸 집계 대상 정류장 PK."""
    return (
        await db.execute(
            select(BusCrowdingLog.stop_id)
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
    return [dict(r) for r in rows]


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

    def _count_level(level: int):
        return func.count().filter(BusCrowdingLog.crowded == level)

    stmt = (
        select(
            hour_expr.label("h"),
            half_expr.label("m"),
            func.avg(BusCrowdingLog.crowded).label("avg_c"),
            func.count().label("samples"),
            func.count(func.distinct(func.date(ts_kst))).label("days"),
            _count_level(1).label("c1"),
            _count_level(2).label("c2"),
            _count_level(3).label("c3"),
            _count_level(4).label("c4"),
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

    # 폴백 경로는 접근 단위 dedup 없이 로그를 그대로 센다. 사전집계가 채워지기 전
    # 임시 경로이며, 비율이 실제보다 낮게 나올 수 있다(같은 차량 반복 기록).
    return [
        {
            "bucket": int(r.h) * 2 + (1 if int(r.m) >= 30 else 0),
            "avg_crowded": float(r.avg_c),
            "sample_size": int(r.samples),
            "sample_days": int(r.days),
            "c1": int(r.c1), "c2": int(r.c2), "c3": int(r.c3), "c4": int(r.c4),
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
    stop_id = await _resolve_stop_id(db, route_row.id)

    raw_rows = None
    if lookback_days == 60:
        # 사전집계는 항상 60일 윈도우로 계산되므로, 호출자가 다른 lookback을
        # 요청한 경우(현재 API는 기본값만 사용)에는 원본 집계로 바로 간다.
        raw_rows = await _compute_from_precomputed(db, route_row.id, day_type)

    if raw_rows is None:
        raw_rows = await _compute_from_raw_logs(db, route_row.id, day_type, lookback_days)

    rules = await load_calibrations(db)
    points = build_points(
        raw_rows,
        rules=rules,
        route_id=route_row.id,
        stop_id=stop_id,
        day_type=day_type,
    )
    sample_days = max((p["days"] for p in points), default=0)
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
