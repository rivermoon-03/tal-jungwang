"""버스 노선 혼잡도 곡선 사전 집계.

`bus_stats.py`(bus_arrival_stats 사전집계)와 동일한 패턴을 따른다:
매일 03:35 KST APScheduler 잡이 refresh_all_crowding_stats를 호출해
`bus_crowding_logs` 원본을 (route, stop, day_type, bucket)별로 재집계 UPSERT하고,
관련 Redis 캐시(crowding:flow:*)를 무효화한다.

조회는 `crowding_flow.py`의 compute_crowding_flow()가 이 테이블을 우선 사용하고,
비어 있으면(마이그레이션 미적용/첫 나이틀리 이전) 원본 로그 집계로 폴백한다.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_redis

logger = logging.getLogger(__name__)

CROWDING_FLOW_CACHE_PREFIX = "crowding:flow"
CROWDING_STATS_LOOKBACK_DAYS = 60  # compute_crowding_flow 기본 lookback_days와 동일

# 표본 = 차량 1대의 정류장 1회 접근. 로그 행을 그대로 세면 같은 차량이 45초마다
# 재기록돼(정류장·차량당 5분 해상도) 멀리서 잡힌 빈 상태가 과대 대표된다.
# 같은 (route, stop, plate)에서 20분 이상 공백이면 다른 접근으로 보고, 접근당
# arrive_in_seconds 가 가장 작은 관측 1건만 표본으로 쓴다 — 정류장에 가장 가까웠을
# 때의 값이 승차 시점 상태에 가장 가깝다.
_APPROACH_GAP = "20 minutes"

_REFRESH_SQL = f"""
WITH ts AS (
  SELECT route_id, stop_id, plate_no, crowded, arrive_in_seconds,
         (recorded_at AT TIME ZONE 'Asia/Seoul') AS ts_kst,
         recorded_at
  FROM bus_crowding_logs
  WHERE recorded_at >= now() - interval '60 days'
),
marked AS (
  SELECT *,
         CASE WHEN recorded_at - LAG(recorded_at) OVER w > interval '{_APPROACH_GAP}'
                OR LAG(recorded_at) OVER w IS NULL
              THEN 1 ELSE 0 END AS new_run
  FROM ts
  WINDOW w AS (PARTITION BY route_id, stop_id, plate_no ORDER BY recorded_at)
),
runs AS (
  SELECT *,
         SUM(new_run) OVER (
           PARTITION BY route_id, stop_id, plate_no ORDER BY recorded_at
         ) AS run_id
  FROM marked
),
approaches AS (
  SELECT DISTINCT ON (route_id, stop_id, plate_no, run_id)
         route_id, stop_id, crowded, ts_kst
  FROM runs
  ORDER BY route_id, stop_id, plate_no, run_id, arrive_in_seconds ASC, ts_kst DESC
),
bucketed AS (
  SELECT route_id, stop_id, crowded,
         CASE WHEN EXTRACT(ISODOW FROM ts_kst) <= 5 THEN 'weekday' ELSE 'weekend' END AS day_type,
         (EXTRACT(HOUR FROM ts_kst)::int * 2
           + FLOOR(EXTRACT(MINUTE FROM ts_kst) / 30.0)::int) AS bucket,
         DATE(ts_kst) AS day
  FROM approaches
),
agg AS (
  SELECT route_id, stop_id, day_type, bucket,
         AVG(crowded)::numeric(4,2) AS avg_crowded,
         COUNT(*)::int AS sample_size,
         COUNT(DISTINCT day)::int AS sample_days,
         COUNT(*) FILTER (WHERE crowded = 1)::int AS c1,
         COUNT(*) FILTER (WHERE crowded = 2)::int AS c2,
         COUNT(*) FILTER (WHERE crowded = 3)::int AS c3,
         COUNT(*) FILTER (WHERE crowded = 4)::int AS c4
  FROM bucketed
  GROUP BY route_id, stop_id, day_type, bucket
)
INSERT INTO bus_crowding_stats (
  route_id, stop_id, day_type, bucket,
  avg_crowded, sample_size, sample_days, c1, c2, c3, c4, computed_at
)
SELECT route_id, stop_id, day_type, bucket, avg_crowded, sample_size, sample_days,
       c1, c2, c3, c4, :now_ts
FROM agg
ON CONFLICT (route_id, stop_id, day_type, bucket) DO UPDATE
SET avg_crowded = EXCLUDED.avg_crowded,
    sample_size = EXCLUDED.sample_size,
    sample_days = EXCLUDED.sample_days,
    c1 = EXCLUDED.c1,
    c2 = EXCLUDED.c2,
    c3 = EXCLUDED.c3,
    c4 = EXCLUDED.c4,
    computed_at = EXCLUDED.computed_at
"""

_DELETE_STALE_SQL = "DELETE FROM bus_crowding_stats WHERE computed_at < :now_ts"


async def refresh_all_crowding_stats(session: AsyncSession) -> dict[str, Any]:
    """전체 (route, stop, day_type, bucket) 혼잡도 버킷 재계산.

    UPSERT + stale row 삭제(더 이상 60일 윈도우에 데이터가 없는 조합) +
    Redis `crowding:flow:*` 캐시 무효화.

    Returns: {updated, deleted, duration_ms}
    """
    started_at = datetime.now(timezone.utc)
    logger.info("bus_crowding_stats refresh start")

    upsert_res = await session.execute(text(_REFRESH_SQL), {"now_ts": started_at})
    updated = upsert_res.rowcount or 0

    del_res = await session.execute(text(_DELETE_STALE_SQL), {"now_ts": started_at})
    deleted = del_res.rowcount or 0

    await session.commit()

    try:
        redis = await get_redis()
        if redis is not None:
            # SCAN + UNLINK batch (논블로킹), bus_stats.py와 동일 패턴
            batch: list[str] = []
            async for k in redis.scan_iter(match=f"{CROWDING_FLOW_CACHE_PREFIX}:*", count=500):
                batch.append(k)
                if len(batch) >= 500:
                    await redis.unlink(*batch)
                    batch.clear()
            if batch:
                await redis.unlink(*batch)
    except Exception as exc:
        logger.warning("bus_crowding_stats: Redis cache invalidation failed (non-fatal): %s", exc)

    duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
    logger.info(
        "bus_crowding_stats refresh done updated=%d deleted=%d in %dms",
        updated, deleted, duration_ms,
    )
    return {"updated": updated, "deleted": deleted, "duration_ms": duration_ms}
