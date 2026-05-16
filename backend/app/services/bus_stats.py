"""버스 도착 통계 사전 집계 + 조회.

매일 03:30 KST APScheduler 잡이 refresh_all_stats를 호출한다.
요청 시 조회는 Redis 캐시 우선, miss 시 DB.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cached_json, set_cached_json, get_redis

logger = logging.getLogger(__name__)

STATS_CACHE_TTL = 6 * 3600  # 6h
STATS_NEGATIVE_TTL = 600  # 10min: stats 없는 페어 negative cache
STATS_CACHE_PREFIX = "bus:stats"


def _cache_key(route_id: int, stop_id: int, day_type: str, hour: int) -> str:
    return f"{STATS_CACHE_PREFIX}:{route_id}:{stop_id}:{day_type}:{hour}"


def _sec_to_min(sec: int) -> int:
    return max(0, round(sec / 60))


def _row_to_payload(row: dict[str, Any]) -> dict[str, Any]:
    p10 = _sec_to_min(row["p10_interval_sec"])
    p50 = _sec_to_min(row["p50_interval_sec"])
    p90 = _sec_to_min(row["p90_interval_sec"])
    mean = _sec_to_min(row["mean_interval_sec"])
    tolerance = max(0, round((p90 - p10) / 2))
    return {
        "tolerance_min": tolerance,
        "p10_min": p10,
        "p50_min": p50,
        "p90_min": p90,
        "mean_min": mean,
        "sample_size": row["sample_size"],
        "computed_at": row["computed_at"].isoformat() if row.get("computed_at") else None,
    }


_FALLBACK_SQL = """
WITH ordered AS (
  SELECT arrived_at,
         EXTRACT(HOUR FROM arrived_at AT TIME ZONE 'Asia/Seoul')::int AS hod,
         LAG(arrived_at) OVER (ORDER BY arrived_at) AS prev_arr
  FROM bus_arrival_history
  WHERE route_id = :r AND stop_id = :s AND day_type = :d
    AND arrived_at >= now() - interval '28 days'
)
SELECT AVG(EXTRACT(EPOCH FROM (arrived_at - prev_arr)))::int AS mean_sec,
       COUNT(*)::int AS n
FROM ordered
WHERE prev_arr IS NOT NULL
  AND arrived_at - prev_arr BETWEEN interval '30 sec' AND interval '60 min'
  AND hod BETWEEN :h_lo AND :h_hi
"""


async def get_arrival_stats(
    session: AsyncSession,
    route_id: int,
    stop_id: int,
    day_type: str,
    hour: int,
) -> dict[str, Any] | None:
    """캐시 → DB lookup.

    1순위: 사전 집계된 `bus_arrival_stats` (HAVING COUNT >= 8). 풀 분위수 포함.
    2순위: `bus_arrival_history`에서 ±2시간 윈도우 mean only (>= 3 samples).
            `is_low_sample: True` 플래그를 달아 프론트에서 '데이터 부족' 뱃지를 띄운다.
    둘 다 없으면 None (negative caching 포함).
    """
    key = _cache_key(route_id, stop_id, day_type, hour)
    cached = await get_cached_json(key)
    if cached is not None:
        # negative cache sentinel: {"sample_size": None}
        return None if cached.get("sample_size") is None else cached

    row = (await session.execute(text(
        "SELECT p10_interval_sec, p50_interval_sec, p90_interval_sec, "
        "       mean_interval_sec, sample_size, computed_at "
        "FROM bus_arrival_stats "
        "WHERE route_id=:r AND stop_id=:s AND day_type=:d AND hour_of_day=:h"
    ), {"r": route_id, "s": stop_id, "d": day_type, "h": hour})).mappings().first()

    if row is not None:
        payload = _row_to_payload(dict(row))
        await set_cached_json(key, payload, ttl=STATS_CACHE_TTL)
        return payload

    # Fallback: ±2시간 윈도우의 bus_arrival_history 기반 mean only
    h_lo = max(0, hour - 2)
    h_hi = min(23, hour + 2)
    fb = (await session.execute(text(_FALLBACK_SQL), {
        "r": route_id, "s": stop_id, "d": day_type, "h_lo": h_lo, "h_hi": h_hi,
    })).mappings().first()

    if fb is None or fb["n"] is None or fb["n"] < 3:
        await set_cached_json(key, {"sample_size": None}, ttl=STATS_NEGATIVE_TTL)
        return None

    mean_min = _sec_to_min(fb["mean_sec"])
    if mean_min <= 0:
        await set_cached_json(key, {"sample_size": None}, ttl=STATS_NEGATIVE_TTL)
        return None

    payload = {
        "mean_min": mean_min,
        "sample_size": int(fb["n"]),
        "is_low_sample": True,
    }
    await set_cached_json(key, payload, ttl=STATS_NEGATIVE_TTL)
    return payload


_REFRESH_SQL = """
WITH ordered AS (
  SELECT route_id, stop_id, day_type,
         EXTRACT(HOUR FROM arrived_at AT TIME ZONE 'Asia/Seoul')::int AS hod,
         arrived_at,
         LAG(arrived_at) OVER (
           PARTITION BY route_id, stop_id, day_type
           ORDER BY arrived_at
         ) AS prev_arr
  FROM bus_arrival_history
  WHERE arrived_at >= now() - interval '28 days'
),
intervals AS (
  SELECT route_id, stop_id, day_type, hod,
         EXTRACT(EPOCH FROM (arrived_at - prev_arr))::int AS gap_sec
  FROM ordered
  WHERE prev_arr IS NOT NULL
    AND arrived_at - prev_arr BETWEEN interval '30 sec' AND interval '60 min'
),
agg AS (
  SELECT route_id, stop_id, day_type, hod,
         PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY gap_sec)::int AS p10,
         PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY gap_sec)::int AS p50,
         PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY gap_sec)::int AS p90,
         AVG(gap_sec)::int AS mean,
         COUNT(*) AS n
  FROM intervals
  GROUP BY route_id, stop_id, day_type, hod
  HAVING COUNT(*) >= 8
)
INSERT INTO bus_arrival_stats (
  route_id, stop_id, day_type, hour_of_day,
  p10_interval_sec, p50_interval_sec, p90_interval_sec,
  mean_interval_sec, sample_size, computed_at
)
SELECT route_id, stop_id, day_type, hod, p10, p50, p90, mean, n, :now_ts
FROM agg
ON CONFLICT (route_id, stop_id, day_type, hour_of_day) DO UPDATE
SET p10_interval_sec = EXCLUDED.p10_interval_sec,
    p50_interval_sec = EXCLUDED.p50_interval_sec,
    p90_interval_sec = EXCLUDED.p90_interval_sec,
    mean_interval_sec = EXCLUDED.mean_interval_sec,
    sample_size = EXCLUDED.sample_size,
    computed_at = EXCLUDED.computed_at
"""

_DELETE_STALE_SQL = "DELETE FROM bus_arrival_stats WHERE computed_at < :now_ts"


async def refresh_all_stats(session: AsyncSession) -> dict[str, Any]:
    """전체 (route, stop, day_type, hour) 버킷 재계산. UPSERT + stale row 삭제 + Redis 무효화.

    Returns: {updated, deleted, duration_ms}
    """
    started_at = datetime.now(timezone.utc)
    logger.info("bus_arrival_stats refresh start")

    upsert_res = await session.execute(text(_REFRESH_SQL), {"now_ts": started_at})
    updated = upsert_res.rowcount or 0

    del_res = await session.execute(text(_DELETE_STALE_SQL), {"now_ts": started_at})
    deleted = del_res.rowcount or 0

    await session.commit()

    try:
        redis = await get_redis()
        if redis is not None:
            async for k in redis.scan_iter(match=f"{STATS_CACHE_PREFIX}:*"):
                await redis.delete(k)
    except Exception as exc:
        logger.warning("bus_stats: Redis cache invalidation failed (non-fatal): %s", exc)

    duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
    logger.info(
        "bus_arrival_stats refresh done updated=%d deleted=%d in %dms",
        updated, deleted, duration_ms,
    )
    return {"updated": updated, "deleted": deleted, "duration_ms": duration_ms}
