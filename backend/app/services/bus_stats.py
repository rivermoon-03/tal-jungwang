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

from app.core.cache import get_or_fetch_with_lock, get_redis

logger = logging.getLogger(__name__)

STATS_CACHE_TTL = 6 * 3600  # 6h — nightly refresh(03:30 KST)보다 짧아 자가회복
STATS_NEGATIVE_TTL = 600  # 10min: stats 없는 페어 negative cache (fallback 샘플 누적을 빨리 반영)
STATS_CACHE_PREFIX = "bus:stats"

# negative sentinel: bus_arrival_stats에 행이 없고, fallback도 샘플 부족인 경우.
_NO_DATA_SENTINEL: dict[str, Any] = {"sample_size": None}


def _cache_key(route_id: int, stop_id: int, day_type: str, hour: int) -> str:
    return f"{STATS_CACHE_PREFIX}:{route_id}:{stop_id}:{day_type}:{hour}"


def _resolve_stats_ttl(payload: dict[str, Any]) -> int:
    """사전집계 hit(풍부한 표본)만 6h, 그 외(negative/저표본 fallback)는 10min."""
    if payload.get("sample_size") is None or payload.get("is_low_sample"):
        return STATS_NEGATIVE_TTL
    return STATS_CACHE_TTL


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
    """캐시(single-flight) → DB lookup.

    1순위: 사전 집계된 `bus_arrival_stats` (HAVING COUNT >= 8). 풀 분위수 포함.
    2순위: `bus_arrival_history`에서 ±2시간 윈도우 mean only (>= 3 samples).
            `is_low_sample: True` 플래그를 달아 프론트에서 '데이터 부족' 뱃지를 띄운다.
    둘 다 없으면 None (negative caching 포함).

    `get_or_fetch_with_lock`로 캐시-미스 시 동시 요청이 같은 (route_id, stop_id,
    day_type, hour) 조합의 DB 쿼리를 중복으로 날리지 않도록 single-flight 처리한다
    (나이틀리 03:30 재계산 직후 전체 캐시가 비워지는 시점에 특히 유효).
    TTL은 결과에 따라 `_resolve_stats_ttl`이 동적으로 정한다
    (사전집계 hit=6h, negative/저표본 fallback=10min).
    """
    key = _cache_key(route_id, stop_id, day_type, hour)

    async def _fetch() -> dict[str, Any]:
        row = (await session.execute(text(
            "SELECT p10_interval_sec, p50_interval_sec, p90_interval_sec, "
            "       mean_interval_sec, sample_size, computed_at "
            "FROM bus_arrival_stats "
            "WHERE route_id=:r AND stop_id=:s AND day_type=:d AND hour_of_day=:h"
        ), {"r": route_id, "s": stop_id, "d": day_type, "h": hour})).mappings().first()

        if row is not None:
            return _row_to_payload(dict(row))

        # Fallback: ±2시간 윈도우의 bus_arrival_history 기반 mean only
        h_lo = max(0, hour - 2)
        h_hi = min(23, hour + 2)
        fb = (await session.execute(text(_FALLBACK_SQL), {
            "r": route_id, "s": stop_id, "d": day_type, "h_lo": h_lo, "h_hi": h_hi,
        })).mappings().first()

        if fb is None or fb["n"] is None or fb["n"] < 3:
            return dict(_NO_DATA_SENTINEL)

        mean_min = _sec_to_min(fb["mean_sec"])
        if mean_min <= 0:
            return dict(_NO_DATA_SENTINEL)

        return {
            "mean_min": mean_min,
            "sample_size": int(fb["n"]),
            "is_low_sample": True,
        }

    payload = await get_or_fetch_with_lock(key, _resolve_stats_ttl, _fetch)
    return None if payload.get("sample_size") is None else payload


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
            # SCAN + UNLINK batch (논블로킹) — N 키마다 1 RTT 였던 것을 500키/RTT 로 묶는다.
            batch: list[str] = []
            async for k in redis.scan_iter(match=f"{STATS_CACHE_PREFIX}:*", count=500):
                batch.append(k)
                if len(batch) >= 500:
                    await redis.unlink(*batch)
                    batch.clear()
            if batch:
                await redis.unlink(*batch)
    except Exception as exc:
        logger.warning("bus_stats: Redis cache invalidation failed (non-fatal): %s", exc)

    duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
    logger.info(
        "bus_arrival_stats refresh done updated=%d deleted=%d in %dms",
        updated, deleted, duration_ms,
    )
    return {"updated": updated, "deleted": deleted, "duration_ms": duration_ms}


# ── ETA 자가 채점 정확도 집계 ─────────────────────────────────────────────
# bus_eta_samples(수집기가 도착 판정 시 적재)를 (route_number, station_id)별로
# 집계한다. 표본 50 미만 조합은 행을 만들지 않는다 — 신뢰 못 하는 지표를 화면에
# 올리지 않기 위한 하한이며, stale 삭제로 표본이 다시 줄어든 조합도 사라진다.

ETA_ACCURACY_MIN_SAMPLES = 50
ETA_SAMPLES_RETENTION_DAYS = 28

_ETA_ACCURACY_REFRESH_SQL = """
WITH agg AS (
  SELECT route_number, station_id,
         COUNT(*)::int AS n,
         AVG(ABS(error_sec))::int AS mae,
         AVG(error_sec)::int AS bias,
         ROUND(AVG((ABS(error_sec) <= 60)::int)::numeric, 3) AS within60
  FROM bus_eta_samples
  WHERE observed_at >= now() - interval '28 days'
  GROUP BY route_number, station_id
  HAVING COUNT(*) >= :min_samples
)
INSERT INTO bus_eta_accuracy (
  route_number, station_id, sample_size, mae_sec, bias_sec, within60_ratio, updated_at
)
SELECT route_number, station_id, n, mae, bias, within60, :now_ts
FROM agg
ON CONFLICT (route_number, station_id) DO UPDATE
SET sample_size = EXCLUDED.sample_size,
    mae_sec = EXCLUDED.mae_sec,
    bias_sec = EXCLUDED.bias_sec,
    within60_ratio = EXCLUDED.within60_ratio,
    updated_at = EXCLUDED.updated_at
"""

_ETA_ACCURACY_DELETE_STALE_SQL = "DELETE FROM bus_eta_accuracy WHERE updated_at < :now_ts"

# 샘플 보존기간 초과분 삭제 — 집계 윈도우(28일)와 같은 값이라 별도 retention 잡이
# 필요 없다. 이 잡이 곧 소비처이자 청소부다.
_ETA_SAMPLES_PURGE_SQL = (
    "DELETE FROM bus_eta_samples WHERE observed_at < now() - interval '28 days'"
)


async def refresh_eta_accuracy(session: AsyncSession) -> dict[str, Any]:
    """bus_eta_accuracy 전체 재계산. UPSERT + stale row 삭제 + 오래된 샘플 정리.

    Returns: {updated, deleted, purged_samples, duration_ms}
    """
    started_at = datetime.now(timezone.utc)
    logger.info("bus_eta_accuracy refresh start")

    upsert_res = await session.execute(text(_ETA_ACCURACY_REFRESH_SQL), {
        "now_ts": started_at,
        "min_samples": ETA_ACCURACY_MIN_SAMPLES,
    })
    updated = upsert_res.rowcount or 0

    del_res = await session.execute(
        text(_ETA_ACCURACY_DELETE_STALE_SQL), {"now_ts": started_at}
    )
    deleted = del_res.rowcount or 0

    purge_res = await session.execute(text(_ETA_SAMPLES_PURGE_SQL))
    purged = purge_res.rowcount or 0

    await session.commit()

    duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
    logger.info(
        "bus_eta_accuracy refresh done updated=%d deleted=%d purged_samples=%d in %dms",
        updated, deleted, purged, duration_ms,
    )
    return {
        "updated": updated,
        "deleted": deleted,
        "purged_samples": purged,
        "duration_ms": duration_ms,
    }


async def get_eta_accuracy(
    session: AsyncSession, route_number: str, station_id: int
) -> dict[str, Any] | None:
    """(route_number, station_id)의 ETA 정확도 집계 조회. 행이 없으면 None.

    호출처(history-preview)가 응답 자체를 30초 캐시하므로 여기서 별도 Redis
    캐시는 두지 않는다(PK 단건 조회 + 다층 캐시 중복 방지).
    """
    row = (await session.execute(text(
        "SELECT sample_size, mae_sec, bias_sec, within60_ratio, updated_at "
        "FROM bus_eta_accuracy WHERE route_number = :rn AND station_id = :s"
    ), {"rn": route_number, "s": station_id})).mappings().first()

    if row is None:
        return None
    return {
        "sample_size": int(row["sample_size"]),
        "mae_sec": int(row["mae_sec"]),
        "bias_sec": int(row["bias_sec"]),
        "within60_ratio": float(row["within60_ratio"]),
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }
