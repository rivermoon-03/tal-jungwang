# 통계학적 버스 도착 예측 (Distribution Bar 시안) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GBIS 추적 노선의 인접 도착 간격을 (route, stop, day_type, hour) 버킷별 분위수로 사전 집계해, 메인 카드에 "보통 ±N분" 보조 표시 + 상세 시트에 분포 바 헤더를 띄운다.

**Architecture:** 새 테이블 `bus_arrival_stats`(약 1,000 row 상한)에 매일 03:30 KST APScheduler 잡으로 최근 28일치 분위수(p10/p50/p90/mean/n)를 UPSERT. `/api/v1/bus/arrivals/{station}` 응답에 stats를 inline 머지하고, 신규 `/api/v1/bus/arrival-stats/{route_id}/{stop_id}`로 시트 헤더가 별도 lookup. 프론트는 신규 `ArrivalDistributionBar` + `BusStatsHeader` 컴포넌트 두 개를 카드/시트에 꽂는다.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, PostgreSQL 16 (PERCENTILE_CONT), Redis, APScheduler, pytest + pytest-asyncio, React 19, vitest, Tailwind v3.

**Spec:** `docs/superpowers/specs/2026-05-16-stat-bus-arrival-prediction-design.md`

**Note on docs commits:** 이 레포는 `.gitignore`에 `docs/` 전체가 들어 있으므로 spec/plan 파일은 `git add -f`로만 추가된다 (기존 패턴). 코드 변경은 평소대로 커밋한다.

---

## File Structure

| 종류 | 파일 | 책임 |
|---|---|---|
| Create | `scripts/prod_migration_20260516_bus_arrival_stats.sql` | prod에 적용할 idempotent DDL |
| Modify | `scripts/schema.sql` | 동일 DDL 동기화 (docker postgres init용) |
| Modify | `backend/app/models/bus.py` | `BusArrivalStats` SQLAlchemy 모델 추가 |
| Create | `backend/app/services/bus_stats.py` | `refresh_all_stats`, `get_arrival_stats` |
| Modify | `backend/app/services/bus.py` | `get_arrivals` 응답 dict에 stats inline 머지 |
| Modify | `backend/app/api/bus.py` | `/arrival-stats/{route_id}/{stop_id}` 엔드포인트 + history-preview 응답에 stop_id/route_id 추가 |
| Modify | `backend/app/schemas/bus.py` | `ArrivalStats` 스키마 + `ArrivalOut.stats` 필드 |
| Modify | `backend/app/core/scheduler.py` | `_bus_arrival_stats_refresh_job` 등록 |
| Create | `backend/tests/services/test_bus_stats.py` | refresh/get 단위 테스트 |
| Create | `backend/tests/api/test_bus_arrival_stats_api.py` | 신규 API + arrivals 응답 머지 검증 |
| Create | `frontend/src/components/bus/ArrivalDistributionBar.jsx` | 분포 바 (mini/full variant) |
| Create | `frontend/src/components/bus/ArrivalDistributionBar.test.jsx` | 분포 바 단위 테스트 |
| Create | `frontend/src/components/bus/BusStatsHeader.jsx` | 시트 헤더 박스 |
| Create | `frontend/src/components/bus/BusStatsHeader.test.jsx` | 헤더 박스 단위 테스트 |
| Modify | `frontend/src/components/bus/BusArrivalCard.jsx` | sub 텍스트 교체 + mini bar 부착 |
| Modify | `frontend/src/components/schedule/ScheduleDetailModal.jsx` | `BusHistoryContent` 상단에 `BusStatsHeader` 삽입 |
| Modify | `frontend/src/components/bus/BusTimetableDetail.jsx` | 동일하게 `BusStatsHeader` 삽입 |
| Modify | `frontend/src/hooks/useBus.js` | `useBusArrivalStats` 훅 추가 |
| Modify | `CLAUDE.md` | Redis 캐시 키 표 + APScheduler 잡 표 갱신 |

---

## Task 1: DB 마이그레이션 SQL 작성 + 로컬 검증

**Files:**
- Create: `scripts/prod_migration_20260516_bus_arrival_stats.sql`
- Modify: `scripts/schema.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`scripts/prod_migration_20260516_bus_arrival_stats.sql`:

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS bus_arrival_stats (
  route_id INTEGER NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
  stop_id INTEGER NOT NULL REFERENCES bus_stops(id) ON DELETE CASCADE,
  day_type VARCHAR(10) NOT NULL CHECK (day_type IN ('weekday','saturday','sunday')),
  hour_of_day SMALLINT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  p10_interval_sec INTEGER NOT NULL,
  p50_interval_sec INTEGER NOT NULL,
  p90_interval_sec INTEGER NOT NULL,
  mean_interval_sec INTEGER NOT NULL,
  sample_size INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, stop_id, day_type, hour_of_day)
);

COMMIT;
```

- [ ] **Step 2: `scripts/schema.sql` 끝부분(다른 CREATE TABLE 인덱스 근처)에 동일 DDL 동기화**

`scripts/schema.sql`을 열어 마지막 `CREATE TABLE` 정의들 뒤에 위 DDL을 BEGIN/COMMIT 없이 동일 컬럼·제약으로 추가.

- [ ] **Step 3: 로컬 docker postgres에 적용해 통과 여부 확인**

Run:
```bash
docker compose exec -T postgres psql -U user -d transit_hub -v ON_ERROR_STOP=1 -f scripts/prod_migration_20260516_bus_arrival_stats.sql
```

Expected: `BEGIN`, `CREATE TABLE`, `COMMIT` 메시지 — 에러 없음.

- [ ] **Step 4: 테이블 생성 확인**

Run:
```bash
docker compose exec -T postgres psql -U user -d transit_hub -c "\d bus_arrival_stats"
```

Expected: 10개 컬럼 + PK 4 컬럼 composite 출력.

- [ ] **Step 5: Commit**

```bash
git add scripts/prod_migration_20260516_bus_arrival_stats.sql scripts/schema.sql
git commit -m "db(stats): bus_arrival_stats 테이블 추가 (분포 사전 집계)"
```

---

## Task 2: SQLAlchemy 모델 추가

**Files:**
- Modify: `backend/app/models/bus.py`

- [ ] **Step 1: 모델 추가**

`backend/app/models/bus.py` 끝(`BusArrivalHistory` 정의 아래)에 추가:

```python
class BusArrivalStats(Base):
    __tablename__ = "bus_arrival_stats"

    route_id: Mapped[int] = mapped_column(
        ForeignKey("bus_routes.id", ondelete="CASCADE"), primary_key=True
    )
    stop_id: Mapped[int] = mapped_column(
        ForeignKey("bus_stops.id", ondelete="CASCADE"), primary_key=True
    )
    day_type: Mapped[str] = mapped_column(String(10), primary_key=True)
    hour_of_day: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    p10_interval_sec: Mapped[int] = mapped_column(Integer, nullable=False)
    p50_interval_sec: Mapped[int] = mapped_column(Integer, nullable=False)
    p90_interval_sec: Mapped[int] = mapped_column(Integer, nullable=False)
    mean_interval_sec: Mapped[int] = mapped_column(Integer, nullable=False)
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

`SmallInteger`, `Integer`, `DateTime`, `func`이 이미 import 되어있지 않으면 파일 상단 import에 추가한다 (기존 imports 옆에 일관되게).

- [ ] **Step 2: 모델 import 동작 검증**

Run:
```bash
docker compose exec -T backend python -c "from app.models.bus import BusArrivalStats; print(BusArrivalStats.__tablename__)"
```

Expected: `bus_arrival_stats`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/bus.py
git commit -m "models(bus): BusArrivalStats 추가"
```

---

## Task 3: Pydantic 스키마 추가

**Files:**
- Modify: `backend/app/schemas/bus.py`

- [ ] **Step 1: 스키마 추가**

`backend/app/schemas/bus.py`에 다음 클래스 추가 (기존 `Arrival*` 클래스 근처):

```python
class ArrivalStats(BaseModel):
    tolerance_min: int
    p10_min: int
    p50_min: int
    p90_min: int
    mean_min: int
    sample_size: int
    computed_at: datetime | None = None
```

기존 `ArrivalOut`(또는 동일 역할 클래스 — 응답에서 arrival 1건을 표현하는 모델)에 다음 필드 추가:

```python
    stats: ArrivalStats | None = None
```

`ArrivalOut`의 정확한 이름이 다르다면 (예: `BusArrivalItem`) `grep -n "class.*Arrival" backend/app/schemas/bus.py` 로 확인 후 동일하게 적용.

- [ ] **Step 2: pydantic 모델 로드 확인**

Run:
```bash
docker compose exec -T backend python -c "from app.schemas.bus import ArrivalStats; print(ArrivalStats.model_fields.keys())"
```

Expected: `dict_keys(['tolerance_min','p10_min','p50_min','p90_min','mean_min','sample_size','computed_at'])`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/bus.py
git commit -m "schemas(bus): ArrivalStats + ArrivalOut.stats 필드"
```

---

## Task 4: 통계 서비스 — `refresh_all_stats` 테스트

**Files:**
- Create: `backend/tests/services/test_bus_stats.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/services/test_bus_stats.py`:

```python
"""bus_stats.refresh_all_stats / get_arrival_stats 단위 테스트.

가짜 bus_arrival_history 픽스처로 sql aggregation 결과를 검증한다.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bus import BusArrivalStats
from app.services.bus_stats import refresh_all_stats, get_arrival_stats

KST = timezone(timedelta(hours=9))


async def _insert_history(
    db: AsyncSession, route_id: int, stop_id: int, day_type: str,
    base_kst: datetime, gaps_sec: list[int],
) -> None:
    """base_kst부터 gaps_sec 누적해 도착 시각들을 history에 삽입."""
    t = base_kst
    plate = 1000
    for gap in gaps_sec:
        await db.execute(text(
            "INSERT INTO bus_arrival_history (route_id, stop_id, plate_no, arrived_at, day_type, source) "
            "VALUES (:r, :s, :p, :a, :d, 'test')"
        ), {"r": route_id, "s": stop_id, "p": str(plate), "a": t, "d": day_type})
        plate += 1
        t = t + timedelta(seconds=gap)


@pytest.mark.asyncio
async def test_refresh_produces_quantiles_for_sufficient_samples(
    db_session: AsyncSession, seed_route_and_stop,
):
    route_id, stop_id = seed_route_and_stop  # 픽스처: 추적용 임시 route+stop
    base = datetime(2026, 5, 14, 18, 0, tzinfo=KST)  # 목요일 18시 = weekday
    # 9개 도착 → 8개 간격, 모두 4분(240초)
    await _insert_history(db_session, route_id, stop_id, "weekday", base, [240] * 8)
    await db_session.commit()

    result = await refresh_all_stats(db_session)
    assert result["updated"] >= 1

    stats = await get_arrival_stats(db_session, route_id, stop_id, "weekday", 18)
    assert stats is not None
    assert stats["sample_size"] == 8
    assert stats["p10_min"] == 4
    assert stats["p50_min"] == 4
    assert stats["p90_min"] == 4


@pytest.mark.asyncio
async def test_refresh_skips_buckets_below_threshold(
    db_session: AsyncSession, seed_route_and_stop,
):
    route_id, stop_id = seed_route_and_stop
    base = datetime(2026, 5, 14, 18, 0, tzinfo=KST)
    # 7개 도착 → 6개 간격 — 임계 8 미만
    await _insert_history(db_session, route_id, stop_id, "weekday", base, [240] * 6)
    await db_session.commit()

    await refresh_all_stats(db_session)

    stats = await get_arrival_stats(db_session, route_id, stop_id, "weekday", 18)
    assert stats is None


@pytest.mark.asyncio
async def test_outlier_intervals_are_dropped(
    db_session: AsyncSession, seed_route_and_stop,
):
    route_id, stop_id = seed_route_and_stop
    base = datetime(2026, 5, 14, 18, 0, tzinfo=KST)
    # 정상 8개 + outlier 2개 (10초, 2시간)
    gaps = [240] * 8 + [10, 7200]
    await _insert_history(db_session, route_id, stop_id, "weekday", base, gaps)
    await db_session.commit()

    await refresh_all_stats(db_session)

    stats = await get_arrival_stats(db_session, route_id, stop_id, "weekday", 18)
    # outlier 컷으로 표본 8개만 살아남음
    assert stats is not None
    assert stats["sample_size"] == 8


@pytest.mark.asyncio
async def test_refresh_deletes_stale_rows(
    db_session: AsyncSession, seed_route_and_stop,
):
    route_id, stop_id = seed_route_and_stop
    # 먼저 옛 stats row 삽입 (이번 refresh에 포함 안 됨)
    await db_session.execute(text(
        "INSERT INTO bus_arrival_stats "
        "(route_id, stop_id, day_type, hour_of_day, "
        " p10_interval_sec, p50_interval_sec, p90_interval_sec, "
        " mean_interval_sec, sample_size, computed_at) "
        "VALUES (:r, :s, 'weekday', 3, 60, 120, 180, 120, 20, "
        "        now() - interval '7 days')"
    ), {"r": route_id, "s": stop_id})
    await db_session.commit()

    # history는 새벽 3시대 도착이 없음 → refresh가 해당 row를 만들지 않음
    base = datetime(2026, 5, 14, 18, 0, tzinfo=KST)
    await _insert_history(db_session, route_id, stop_id, "weekday", base, [240] * 8)
    await db_session.commit()

    await refresh_all_stats(db_session)

    stale = await get_arrival_stats(db_session, route_id, stop_id, "weekday", 3)
    assert stale is None
```

`seed_route_and_stop` 픽스처가 기존 `conftest.py`에 없으면 같은 디렉토리 `conftest.py`(없으면 신규)에 추가:

```python
import pytest
from sqlalchemy import text

@pytest.fixture
async def seed_route_and_stop(db_session):
    """추적 표시용 임시 (route, stop) 페어를 만든다."""
    await db_session.execute(text(
        "INSERT INTO bus_routes (route_number, gbis_route_id) "
        "VALUES ('TEST33', '999999999') RETURNING id"
    ))
    route_id = (await db_session.execute(text(
        "SELECT id FROM bus_routes WHERE route_number = 'TEST33'"
    ))).scalar_one()
    await db_session.execute(text(
        "INSERT INTO bus_stops (name, gbis_station_id, latitude, longitude) "
        "VALUES ('테스트정류장', '999999000', 37.34, 126.73)"
    ))
    stop_id = (await db_session.execute(text(
        "SELECT id FROM bus_stops WHERE gbis_station_id = '999999000'"
    ))).scalar_one()
    await db_session.commit()
    yield (route_id, stop_id)
    await db_session.execute(text("DELETE FROM bus_arrival_history WHERE route_id=:r"), {"r": route_id})
    await db_session.execute(text("DELETE FROM bus_arrival_stats WHERE route_id=:r"), {"r": route_id})
    await db_session.execute(text("DELETE FROM bus_routes WHERE id=:r"), {"r": route_id})
    await db_session.execute(text("DELETE FROM bus_stops WHERE id=:s"), {"s": stop_id})
    await db_session.commit()
```

기존 `db_session` 픽스처 시그니처는 `backend/tests/conftest.py`에서 확인해 일치시킨다. `bus_routes` / `bus_stops` 컬럼 이름이 다르면 (`grep "class BusRoute\|class BusStop" backend/app/models/bus.py`) 픽스처 SQL을 그에 맞춘다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run:
```bash
docker compose exec -T backend pytest backend/tests/services/test_bus_stats.py -v
```

Expected: 4 FAIL — `ImportError: cannot import name 'refresh_all_stats' from 'app.services.bus_stats'` 또는 모듈 없음.

---

## Task 5: 통계 서비스 — 구현 (`refresh_all_stats` + `get_arrival_stats`)

**Files:**
- Create: `backend/app/services/bus_stats.py`

- [ ] **Step 1: 모듈 작성**

`backend/app/services/bus_stats.py`:

```python
"""버스 도착 통계 사전 집계 + 조회.

새벽 03:30 KST APScheduler 잡이 refresh_all_stats를 호출한다.
요청 시 조회는 Redis 캐시 우선, miss 시 DB.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cached_json, set_cached_json, get_redis

logger = logging.getLogger(__name__)

STATS_CACHE_TTL = 6 * 3600  # 6h
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


async def get_arrival_stats(
    session: AsyncSession,
    route_id: int,
    stop_id: int,
    day_type: str,
    hour: int,
) -> dict[str, Any] | None:
    """캐시 → DB lookup. 데이터 없으면 None."""
    key = _cache_key(route_id, stop_id, day_type, hour)
    cached = await get_cached_json(key)
    if cached is not None:
        return cached if cached.get("sample_size") is not None else None

    row = (await session.execute(text(
        "SELECT p10_interval_sec, p50_interval_sec, p90_interval_sec, "
        "       mean_interval_sec, sample_size, computed_at "
        "FROM bus_arrival_stats "
        "WHERE route_id=:r AND stop_id=:s AND day_type=:d AND hour_of_day=:h"
    ), {"r": route_id, "s": stop_id, "d": day_type, "h": hour})).mappings().first()

    if row is None:
        # negative caching — null 표식. 짧은 TTL.
        await set_cached_json(key, {"sample_size": None}, ttl=600)
        return None

    payload = _row_to_payload(dict(row))
    await set_cached_json(key, payload, ttl=STATS_CACHE_TTL)
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

_DELETE_STALE_SQL = """
DELETE FROM bus_arrival_stats WHERE computed_at < :now_ts
"""


async def refresh_all_stats(session: AsyncSession) -> dict[str, Any]:
    """전체 (route, stop, day_type, hour) 버킷을 재계산한다.

    Returns: {updated, deleted, duration_ms}
    """
    started_at = datetime.now(timezone.utc)
    logger.info("bus_arrival_stats refresh start")

    # UPSERT
    upsert_res = await session.execute(text(_REFRESH_SQL), {"now_ts": started_at})
    updated = upsert_res.rowcount or 0

    # 이번 round에 안 닿은 row 삭제
    del_res = await session.execute(text(_DELETE_STALE_SQL), {"now_ts": started_at})
    deleted = del_res.rowcount or 0

    await session.commit()

    # Redis 무효화 — bus:stats:* 전체 SCAN+DEL (총량 < 1000개)
    redis = get_redis()
    if redis is not None:
        async for key in redis.scan_iter(match=f"{STATS_CACHE_PREFIX}:*"):
            await redis.delete(key)

    duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
    logger.info("bus_arrival_stats refresh done updated=%d deleted=%d in %dms",
                updated, deleted, duration_ms)
    return {"updated": updated, "deleted": deleted, "duration_ms": duration_ms}
```

`get_redis()` import 경로가 다르다면 (`grep "def get_redis\|^redis " backend/app/core/cache.py`) 정확한 함수명/경로를 사용.

- [ ] **Step 2: 테스트 실행 — 통과 확인**

Run:
```bash
docker compose exec -T backend pytest backend/tests/services/test_bus_stats.py -v
```

Expected: 4 PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/bus_stats.py backend/tests/services/test_bus_stats.py backend/tests/conftest.py
git commit -m "services(bus_stats): refresh_all_stats + get_arrival_stats (분위수 사전 집계)"
```

---

## Task 6: APScheduler 잡 등록

**Files:**
- Modify: `backend/app/core/scheduler.py`

- [ ] **Step 1: 잡 함수 + 등록 추가**

`backend/app/core/scheduler.py`의 기존 `_bus_poll_job` 정의 패턴을 따라 새 함수 추가:

```python
async def _bus_arrival_stats_refresh_job() -> None:
    """매일 03:30 KST에 bus_arrival_stats 전체 재계산."""
    from app.services.bus_stats import refresh_all_stats
    from app.core.database import async_session_factory

    async with async_session_factory() as session:
        try:
            result = await refresh_all_stats(session)
            logger.info("bus_arrival_stats refresh: %s", result)
        except Exception:
            logger.exception("bus_arrival_stats refresh failed")
            # discord 알림이 다른 잡에서 사용된다면 동일 패턴 호출
```

scheduler `start()` 또는 `add_jobs()`(기존 이름 그대로) 안에 등록 추가:

```python
scheduler.add_job(
    _bus_arrival_stats_refresh_job,
    CronTrigger(hour=3, minute=30, timezone="Asia/Seoul"),
    id="bus_arrival_stats_refresh",
    max_instances=1,
    replace_existing=True,
)
```

- [ ] **Step 2: 백엔드 재시작해 등록 확인**

Run:
```bash
docker compose restart backend
docker compose logs backend --tail=80 | grep -i "stats\|scheduler"
```

Expected: "Added job ... bus_arrival_stats_refresh" 로그.

- [ ] **Step 3: 수동 1회 실행으로 동작 검증**

Run:
```bash
docker compose exec -T backend python -c "
import asyncio
from app.core.database import async_session_factory
from app.services.bus_stats import refresh_all_stats

async def main():
    async with async_session_factory() as s:
        print(await refresh_all_stats(s))

asyncio.run(main())
"
```

Expected: `{'updated': N, 'deleted': 0, 'duration_ms': ...}` — N은 로컬 prod-sync 데이터 양에 따라 다르며 0이어도 됨(이력 없으면 정상).

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/scheduler.py
git commit -m "scheduler: bus_arrival_stats 매일 03:30 KST refresh 잡 추가"
```

---

## Task 7: `get_arrivals` 응답에 stats inline 머지 — 테스트

**Files:**
- Create: `backend/tests/api/test_bus_arrival_stats_api.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/api/test_bus_arrival_stats_api.py`:

```python
"""GET /api/v1/bus/arrivals 응답에 stats 머지 검증 + 신규 /arrival-stats 엔드포인트."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import text

KST = timezone(timedelta(hours=9))


@pytest.mark.asyncio
async def test_arrival_stats_endpoint_returns_null_when_no_data(
    client: AsyncClient, seed_route_and_stop,
):
    route_id, stop_id = seed_route_and_stop
    resp = await client.get(f"/api/v1/bus/arrival-stats/{route_id}/{stop_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["stats"] is None


@pytest.mark.asyncio
async def test_arrival_stats_endpoint_returns_stats_when_present(
    client: AsyncClient, db_session, seed_route_and_stop,
):
    from app.services.bus_stats import refresh_all_stats

    route_id, stop_id = seed_route_and_stop
    base = datetime(2026, 5, 14, 18, 0, tzinfo=KST)
    # 9개 도착 → 8개 간격 (240초)
    t = base
    for i in range(9):
        await db_session.execute(text(
            "INSERT INTO bus_arrival_history (route_id, stop_id, plate_no, arrived_at, day_type, source) "
            "VALUES (:r, :s, :p, :a, 'weekday', 'test')"
        ), {"r": route_id, "s": stop_id, "p": str(2000 + i), "a": t})
        t = t + timedelta(seconds=240)
    await db_session.commit()
    await refresh_all_stats(db_session)

    resp = await client.get(
        f"/api/v1/bus/arrival-stats/{route_id}/{stop_id}?hour=18&day_type=weekday"
    )
    assert resp.status_code == 200
    body = resp.json()
    stats = body["data"]["stats"]
    assert stats is not None
    assert stats["p50_min"] == 4
    assert stats["sample_size"] == 8
```

- [ ] **Step 2: 실패 확인**

Run:
```bash
docker compose exec -T backend pytest backend/tests/api/test_bus_arrival_stats_api.py -v
```

Expected: 2 FAIL — 엔드포인트 없음 (404 or url not found).

---

## Task 8: API — `/arrival-stats` 엔드포인트 + `/arrivals` 응답에 stats 머지

**Files:**
- Modify: `backend/app/api/bus.py`
- Modify: `backend/app/services/bus.py`

- [ ] **Step 1: `/arrival-stats/{route_id}/{stop_id}` 엔드포인트 추가**

`backend/app/api/bus.py`의 다른 GET 핸들러들 사이에 추가:

```python
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
    """특정 (route_id, stop_id) 페어의 이 시간대 도착 분포 통계."""
    from app.services.bus_stats import get_arrival_stats

    KST = ZoneInfo("Asia/Seoul")
    now = datetime.now(KST)
    if hour is None:
        hour = now.hour
    if day_type is None:
        wd = now.weekday()
        day_type = "weekday" if wd <= 4 else ("saturday" if wd == 5 else "sunday")

    stats = await get_arrival_stats(db, route_id, stop_id, day_type, hour)

    return ApiResponse.ok({
        "route_id": route_id,
        "stop_id": stop_id,
        "day_type": day_type,
        "hour_of_day": hour,
        "stats": stats,
    })
```

상단 import 부족분 추가 (`ZoneInfo`, `datetime`, `Query`는 보통 이미 있음).

- [ ] **Step 2: `get_arrivals`에 stats inline 머지**

`backend/app/services/bus.py`의 `get_arrivals()` 함수 안, 각 arrival dict를 만든 직후(이미 `avg_interval_minutes` 같은 필드를 부착하는 자리 인근)에 추가:

```python
from app.services.bus_stats import get_arrival_stats  # 파일 상단으로

# ... get_arrivals 안에서 ...
KST = ZoneInfo("Asia/Seoul")
now_kst = datetime.now(KST)
hour = now_kst.hour
wd = now_kst.weekday()
day_type_now = "weekday" if wd <= 4 else ("saturday" if wd == 5 else "sunday")

for item in arrivals_to_return:  # 기존 빌드된 arrival dict 리스트 이름에 맞춤
    if item.get("arrival_type") != "realtime":
        continue
    route_id = item.get("route_id")
    if route_id is None:
        continue
    stats = await get_arrival_stats(
        session, route_id, stop_id_for_this_call, day_type_now, hour
    )
    if stats is not None:
        item["stats"] = stats
```

`arrivals_to_return` / `stop_id_for_this_call` 변수명은 실제 코드 흐름에 맞춰 grep 후 정확히 매칭한다. 시그니처 `get_arrivals(db, station_id, ...)`이므로 그 함수가 알고 있는 `station_id` = `stop_id` (`bus_stops.id` 기준)를 그대로 쓴다.

- [ ] **Step 3: 테스트 실행 — 통과 확인**

Run:
```bash
docker compose exec -T backend pytest backend/tests/api/test_bus_arrival_stats_api.py -v
```

Expected: 2 PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/bus.py backend/app/services/bus.py backend/tests/api/test_bus_arrival_stats_api.py
git commit -m "api(bus): /arrival-stats 엔드포인트 + /arrivals 응답에 stats inline 머지"
```

---

## Task 9: history-preview 응답에 `route_id`, `stop_id` 추가

**Files:**
- Modify: `backend/app/api/bus.py`

상세 시트의 `BusStatsHeader`가 호출할 lookup에 (route_id, stop_id)가 필요한데, 시트 컴포넌트는 현재 `routeNumber`만 보유한다. history-preview 응답을 가장 자연스러운 정보 출처로 활용한다.

- [ ] **Step 1: 응답에 두 키 추가**

`backend/app/api/bus.py`의 `bus_history_preview()` 응답 빌드부(파일 247~250 줄 인근, `return ApiResponse.ok({...})` 안)에 다음을 추가:

```python
    # 매칭된 routes 중 첫 번째와 그 routes 안에서 history가 가장 많이 찍힌 stop_id 1개
    primary_route_id = route_ids[0] if route_ids else None
    primary_stop_id = None
    if rows:
        # 가장 빈도 높은 stop 1개 (Counter 없이 단순화)
        from collections import Counter
        stop_counts = Counter()
        for arr_date, arr_time, sname in rows:
            # rows에는 stop_name만 있고 stop_id가 없으므로 별도 쿼리 한 번
            pass
        # 별도 쿼리: 같은 route_ids·target_dates 범위에서 (stop_id, count) 상위
        sid_stmt = (
            select(BusArrivalHistory.stop_id, func.count().label("c"))
            .where(BusArrivalHistory.route_id.in_(route_ids))
            .where(func.date(arrived_kst).in_(target_dates))
            .group_by(BusArrivalHistory.stop_id)
            .order_by(text("c DESC"))
            .limit(1)
        )
        sid_row = (await db.execute(sid_stmt)).first()
        if sid_row is not None:
            primary_stop_id = sid_row[0]

    return ApiResponse.ok({
        "route_number": route_number,
        "route_id": primary_route_id,
        "stop_id": primary_stop_id,
        "stop_name": stop_name or "",
        "columns": columns,
    })
```

코드를 정리해 `from collections import Counter` 자리는 사용 안 하면 제거.

- [ ] **Step 2: 수동 응답 확인**

Run (백엔드 띄운 상태에서):
```bash
curl -s http://localhost:8000/api/v1/bus/history-preview/시흥33 | python -m json.tool | head -20
```

Expected: 응답 JSON `data` 안에 `route_id`, `stop_id` 키가 정수로 포함.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/bus.py
git commit -m "api(bus): history-preview 응답에 primary route_id/stop_id 노출"
```

---

## Task 10: Frontend — `ArrivalDistributionBar` 컴포넌트 + 테스트

**Files:**
- Create: `frontend/src/components/bus/ArrivalDistributionBar.jsx`
- Create: `frontend/src/components/bus/ArrivalDistributionBar.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/components/bus/ArrivalDistributionBar.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ArrivalDistributionBar from './ArrivalDistributionBar'

describe('ArrivalDistributionBar', () => {
  it('renders nothing when p10/p50/p90 all null', () => {
    const { container } = render(
      <ArrivalDistributionBar p10Min={null} p50Min={null} p90Min={null} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('mini variant has no labels', () => {
    render(<ArrivalDistributionBar p10Min={1} p50Min={4} p90Min={9} variant="mini" />)
    expect(screen.queryByText('p10')).toBeNull()
    expect(screen.queryByText('p90')).toBeNull()
  })

  it('full variant shows p10/중앙값/p90 labels', () => {
    render(<ArrivalDistributionBar p10Min={1} p50Min={4} p90Min={9} variant="full" />)
    expect(screen.getByText(/p10/i)).toBeInTheDocument()
    expect(screen.getByText(/중앙값/)).toBeInTheDocument()
    expect(screen.getByText(/p90/i)).toBeInTheDocument()
  })

  it('p10 == p90 still renders a centered dot (no crash)', () => {
    const { container } = render(
      <ArrivalDistributionBar p10Min={5} p50Min={5} p90Min={5} variant="full" />
    )
    // 그냥 정상 렌더되는지만 확인
    expect(container.firstChild).not.toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run:
```bash
cd frontend && npm test -- ArrivalDistributionBar
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 컴포넌트 구현**

`frontend/src/components/bus/ArrivalDistributionBar.jsx`:

```jsx
// p10/p50/p90 분 단위 분포 바.
// variant='mini' (8px, 카드용) / 'full' (14px + 라벨, 시트 헤더용)
export default function ArrivalDistributionBar({
  p10Min,
  p50Min,
  p90Min,
  variant = 'mini',
  maxMin: maxMinProp,
}) {
  if (p10Min == null || p50Min == null || p90Min == null) return null

  const maxMin = Math.max(maxMinProp ?? 20, p90Min + 1)
  const left = (p10Min / maxMin) * 100
  const width = Math.max(((p90Min - p10Min) / maxMin) * 100, 1.5)
  const dot = (p50Min / maxMin) * 100

  const isFull = variant === 'full'
  const barHeight = isFull ? 'h-3.5' : 'h-2'
  const dotSize = isFull ? 'w-3 h-3' : 'w-2.5 h-2.5'

  return (
    <div className="w-full">
      <div className={`relative w-full ${barHeight} rounded-full bg-slate-100 dark:bg-surface-dark-alt overflow-hidden`}>
        <div
          className={`absolute top-0 bottom-0 ${isFull ? 'bg-gradient-to-r from-accent/20 via-accent/40 to-accent/20' : 'bg-accent/30'} rounded-full`}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 ${dotSize} rounded-full bg-accent border-2 border-white dark:border-surface-dark shadow-sm`}
          style={{ left: `${dot}%` }}
        />
      </div>
      {isFull && (
        <div className="mt-1.5 flex justify-between text-[10px] text-mute dark:text-mute-dark font-medium">
          <span>p10 {p10Min}분</span>
          <span>중앙값 {p50Min}분</span>
          <span>p90 {p90Min}분</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd frontend && npm test -- ArrivalDistributionBar
```

Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/bus/ArrivalDistributionBar.jsx frontend/src/components/bus/ArrivalDistributionBar.test.jsx
git commit -m "ui(bus): ArrivalDistributionBar 컴포넌트 (mini/full variant)"
```

---

## Task 11: Frontend — `BusStatsHeader` 컴포넌트 + 테스트

**Files:**
- Create: `frontend/src/components/bus/BusStatsHeader.jsx`
- Create: `frontend/src/components/bus/BusStatsHeader.test.jsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/components/bus/BusStatsHeader.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BusStatsHeader from './BusStatsHeader'

describe('BusStatsHeader', () => {
  it('returns null when stats is null', () => {
    const { container } = render(<BusStatsHeader stats={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when stats is undefined', () => {
    const { container } = render(<BusStatsHeader />)
    expect(container.firstChild).toBeNull()
  })

  it('renders mean/sample text and full distribution bar', () => {
    render(
      <BusStatsHeader
        stats={{
          p10_min: 1,
          p50_min: 4,
          p90_min: 9,
          mean_min: 4,
          tolerance_min: 4,
          sample_size: 28,
        }}
        dayLabel="평일"
        hourLabel="18시"
      />
    )
    expect(screen.getByText(/약 4분/)).toBeInTheDocument()
    expect(screen.getByText(/평일 · 18시/)).toBeInTheDocument()
    expect(screen.getByText(/표본 28회/)).toBeInTheDocument()
    expect(screen.getByText(/중앙값/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run:
```bash
cd frontend && npm test -- BusStatsHeader
```

Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 컴포넌트 구현**

`frontend/src/components/bus/BusStatsHeader.jsx`:

```jsx
import ArrivalDistributionBar from './ArrivalDistributionBar'

export default function BusStatsHeader({ stats, dayLabel, hourLabel }) {
  if (!stats) return null
  const subtitleParts = []
  if (dayLabel) subtitleParts.push(dayLabel)
  if (hourLabel) subtitleParts.push(hourLabel)
  const subtitle = subtitleParts.join(' · ')

  return (
    <div className="rounded-card bg-surface-alt dark:bg-surface-dark-alt border border-line dark:border-line-dark p-3.5 mb-4">
      <div className="flex items-baseline justify-between mb-2.5">
        <span className="text-eta-mob font-black text-ink dark:text-white leading-none tabular-nums">
          약 {stats.mean_min}분
        </span>
        {subtitle && (
          <span className="text-[11px] text-mute dark:text-mute-dark">{subtitle}</span>
        )}
      </div>
      <ArrivalDistributionBar
        p10Min={stats.p10_min}
        p50Min={stats.p50_min}
        p90Min={stats.p90_min}
        variant="full"
      />
      <div className="mt-2 text-[10px] text-mute dark:text-mute-dark text-right">
        표본 {stats.sample_size}회
      </div>
    </div>
  )
}
```

`surface-alt` 토큰이 없으면 `bg-slate-50 dark:bg-surface-dark-alt`로 대체.

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd frontend && npm test -- BusStatsHeader
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/bus/BusStatsHeader.jsx frontend/src/components/bus/BusStatsHeader.test.jsx
git commit -m "ui(bus): BusStatsHeader 컴포넌트 (시트 통계 헤더 박스)"
```

---

## Task 12: Frontend — `useBusArrivalStats` 훅 추가

**Files:**
- Modify: `frontend/src/hooks/useBus.js`

- [ ] **Step 1: 훅 추가**

`frontend/src/hooks/useBus.js`의 `useBusHistoryPreview` 정의 근처에:

```js
export function useBusArrivalStats(routeId, stopId) {
  return useApi(routeId && stopId ? `/bus/arrival-stats/${routeId}/${stopId}` : null, {
    staleMs: 5 * 60_000,
  })
}
```

`useApi` 옵션 키 이름이 다르다면 (`grep "function useApi" frontend/src/hooks` 또는 같은 파일 안) 동일 패턴(예: `revalidateMs`, `refreshInterval`)으로 맞춤. 다른 훅들이 옵션을 어떻게 쓰는지 보고 일치.

- [ ] **Step 2: 동작 확인 (수동)**

Run (백엔드 + frontend dev server 띄운 상태):
```bash
cd frontend && npm run dev
```

브라우저에서 `/schedule` 진입 → 시흥33 카드 클릭 → DevTools Network에 `/bus/arrival-stats/...` 호출이 있어야 함 (Task 13에서 호출자 부착 후 등장 예상).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useBus.js
git commit -m "hooks(bus): useBusArrivalStats 훅 추가"
```

---

## Task 13: Frontend — `BusArrivalCard` 통계 표시 통합

**Files:**
- Modify: `frontend/src/components/bus/BusArrivalCard.jsx`

- [ ] **Step 1: import + sub 텍스트 분기 + mini bar 부착**

`BusArrivalCard.jsx`:

import 추가:
```jsx
import ArrivalDistributionBar from './ArrivalDistributionBar'
```

`computeDisplay()` 안 realtime 분기 (`// realtime` 주석 아래 110~118줄)에서 sub를 stats 우선으로:

```jsx
  // realtime
  const sec0 = shown[0].arrive_in_seconds ?? 0
  const stats = arrivals[0]?.stats
  if (sec0 < IMMINENT_THRESHOLD_SEC) {
    return { etaValue: '곧', etaSub: `${Math.max(0, sec0)}초 후`, imminent: true, stats }
  }
  const min0 = realtimeSecToMinutes(sec0)
  let sub = null
  if (stats?.tolerance_min != null) {
    sub = `보통 ±${stats.tolerance_min}분`
  } else {
    const sec1 = shown[1]?.arrive_in_seconds
    if (sec1 != null) {
      const min1 = realtimeSecToMinutes(sec1)
      sub = `다음 +${min1}분`
    }
  }
  return { etaValue: min0, etaSub: sub, imminent: false, stats }
```

timetable 분기는 stats 없음 — `stats: null` 유지로 통일:
```jsx
  if (isTimetable) {
    const a0 = shown[0]
    if (a0.is_tomorrow) {
      return { etaValue: '내일', etaSub: a0.depart_at, imminent: false, stats: null }
    }
    // ... 기존 분기 동일, return에 stats: null 추가
  }
```

기본 (empty) 분기에도 `stats: null`.

함수 분해 후 컴포넌트 본문:

```jsx
  const { etaValue, etaSub, imminent, stats } = computeDisplay(arrivals)
```

`inner` JSX 끝(이후 `</div>` 직전) 바로 위에 mini bar 조건부 부착 — `<div>` 가 row이고 그 아래 분포 바를 추가하려면 row 자체를 `<div>` 가로레이아웃 그대로 두고 카드 wrapper 안에서 sibling으로 분포 바를 두는 게 자연스럽다. wrapper를 다음과 같이 수정:

```jsx
  const cardBody = (
    <>
      {inner}
      {stats?.p50_min != null && (
        <div className="px-3 pb-2 -mt-0.5">
          <ArrivalDistributionBar
            p10Min={stats.p10_min}
            p50Min={stats.p50_min}
            p90Min={stats.p90_min}
            variant="mini"
          />
        </div>
      )}
    </>
  )
```

그리고 기존 `if (isClickable)` 분기에서 button 안에 `{inner}` 대신 `{cardBody}`, 마지막 fallback `<div>` 안에서도 `{inner}` 대신 `{cardBody}`로 교체.

- [ ] **Step 2: 기존 카드 테스트 갱신**

`frontend/src/components/bus/BusArrivalCard.test.jsx`가 있다면 다음 케이스를 추가 (없으면 신규):

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BusArrivalCard from './BusArrivalCard'

// stats 없을 때 — 기존 "다음 +N분" 유지
it('shows next-arrival sub when stats absent', () => {
  render(
    <BusArrivalCard
      arrivals={[
        { route_no: '시흥33', route_id: 12, destination: '정왕역', arrival_type: 'realtime', arrive_in_seconds: 180 },
        { route_no: '시흥33', route_id: 12, destination: '정왕역', arrival_type: 'realtime', arrive_in_seconds: 540 },
      ]}
      stationId={100}
      onTimetableClick={() => {}}
    />
  )
  expect(screen.getByText(/다음 \+9분/)).toBeInTheDocument()
})

// stats 있을 때 — "보통 ±N분"로 교체 + mini bar 렌더
it('shows tolerance sub and mini distribution bar when stats present', () => {
  render(
    <BusArrivalCard
      arrivals={[
        {
          route_no: '시흥33', route_id: 12, destination: '정왕역',
          arrival_type: 'realtime', arrive_in_seconds: 180,
          stats: { tolerance_min: 4, p10_min: 1, p50_min: 4, p90_min: 9, mean_min: 4, sample_size: 28 },
        },
      ]}
      stationId={100}
      onTimetableClick={() => {}}
    />
  )
  expect(screen.getByText(/보통 ±4분/)).toBeInTheDocument()
})
```

- [ ] **Step 3: 테스트 실행 — 통과 확인**

Run:
```bash
cd frontend && npm test -- BusArrivalCard
```

Expected: 2 PASS (+ 기존 테스트 PASS).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/bus/BusArrivalCard.jsx frontend/src/components/bus/BusArrivalCard.test.jsx
git commit -m "ui(bus): BusArrivalCard에 stats 보조 텍스트 + mini 분포 바"
```

---

## Task 14: Frontend — 상세 시트 (BusHistoryContent) 헤더 통합

**Files:**
- Modify: `frontend/src/components/schedule/ScheduleDetailModal.jsx`
- Modify: `frontend/src/components/bus/BusTimetableDetail.jsx`

- [ ] **Step 1: `ScheduleDetailModal.jsx`의 `BusHistoryContent` 본문 최상단에 헤더 삽입**

`frontend/src/components/schedule/ScheduleDetailModal.jsx`의 `BusHistoryContent` 함수 (469 줄 인근) 안, `if (loading) return ...` 검사 이전에 stats 조회와 헤더 변수 준비:

```jsx
import BusStatsHeader from '../bus/BusStatsHeader'
import { useBusHistoryPreview, useBusArrivalStats } from '../../hooks/useBus'

function BusHistoryContent({ routeNumber }) {
  const { data, loading, error } = useBusHistoryPreview(routeNumber)
  const routeId = data?.route_id
  const stopId = data?.stop_id
  const { data: statsData } = useBusArrivalStats(routeId, stopId)
  // ... 기존 로직 그대로 ...
```

응답에서 stats 페이로드 풀기:

```jsx
  const stats = statsData?.stats ?? null
  const dayLabel = stats ? ({
    weekday: '평일', saturday: '토요일', sunday: '일/공휴일',
  }[statsData?.day_type] ?? null) : null
  const hourLabel = statsData?.hour_of_day != null ? `${statsData.hour_of_day}시` : null
```

기존 return JSX의 최상단(첫 `<p>` 안내문 위)에 삽입:

```jsx
  return (
    <div>
      <BusStatsHeader stats={stats} dayLabel={dayLabel} hourLabel={hourLabel} />
      <p className="text-xs text-slate-400 ... ">
      ...
```

- [ ] **Step 2: `BusTimetableDetail.jsx`도 동일 패턴 적용**

`frontend/src/components/bus/BusTimetableDetail.jsx`에서 사용하는 데이터 흐름을 확인 후, `useBusHistoryPreview`로부터 동일하게 route_id/stop_id를 얻어 `<BusStatsHeader />`를 최상단에 삽입.

(파일 안에서 `useBusHistoryPreview` 호출이 이미 있다면 거기서 응답에 추가된 `route_id`, `stop_id`만 풀어 쓰면 된다.)

- [ ] **Step 3: 수동 확인 (dev server)**

Run:
```bash
cd frontend && npm run dev
```

브라우저에서 시흥33 카드 클릭 → 시트 진입 → 상단에 "약 N분" + 분포 바 헤더가 보여야 함. stats가 없는 노선이면 헤더 자체가 안 보임 (정상).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/schedule/ScheduleDetailModal.jsx frontend/src/components/bus/BusTimetableDetail.jsx
git commit -m "ui(bus): 상세 시트 상단에 BusStatsHeader 삽입"
```

---

## Task 15: CLAUDE.md — Redis 키 표 + APScheduler 표 갱신

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Redis 키 표에 추가**

`## Redis 캐시 키 규칙` 표(혼잡도 곡선 행 인근)에 한 줄 추가:

```markdown
| 버스 도착 통계(분위수) | `bus:stats:{route_id}:{stop_id}:{day_type}:{hour}` | 6시간 | 요청 시 캐시-어사이드 + 매일 03:30 잡 후 무효화 |
```

- [ ] **Step 2: APScheduler 작업 요약 표에 추가**

`## APScheduler 작업 요약` 표에 한 줄 추가:

```markdown
| 버스 도착 통계 재계산 (`_bus_arrival_stats_refresh_job`) | 매일 03:30 KST | — |
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): Redis bus:stats 키 + 통계 재계산 잡 추가"
```

---

## Task 16: 수동 verification + prod 적용

**Files:** (없음)

- [ ] **Step 1: 로컬에서 prod 데이터로 전체 흐름 검증**

```bash
# prod 데이터 로컬 복제 (volatile 로그 포함 여부는 prod-sync 스킬이 물어봄)
# 사용자에게 /prod-sync 스킬 호출 요청

# 백엔드/프론트 재시작 후
docker compose exec -T backend python -c "
import asyncio
from app.core.database import async_session_factory
from app.services.bus_stats import refresh_all_stats

async def main():
    async with async_session_factory() as s:
        print(await refresh_all_stats(s))

asyncio.run(main())
"
```

Expected: `updated`이 양수 (추적 페어 ×3 day_type ×시간대 = 수십~수백). `deleted=0`.

- [ ] **Step 2: psql로 row sanity check**

Run:
```bash
docker compose exec -T postgres psql -U user -d transit_hub -c "
SELECT route_id, stop_id, day_type, hour_of_day,
       p10_interval_sec/60 AS p10_min,
       p50_interval_sec/60 AS p50_min,
       p90_interval_sec/60 AS p90_min,
       sample_size
FROM bus_arrival_stats
ORDER BY sample_size DESC
LIMIT 10"
```

Expected: 노선별 표본 수 + 분위수 값. p10 ≤ p50 ≤ p90 단조 증가.

- [ ] **Step 3: dev server에서 실제 UI 확인**

체크리스트:
- 시흥33 메인 카드에 "보통 ±N분" 표시 (stats 있을 때)
- 카드 하단 mini 분포 바 렌더
- 카드 클릭 → 시트 진입 → 상단에 "약 N분" 헤더 박스 + full 분포 바
- 다크모드 토글 시 색상 정상 (도트 흰 테두리 → dark에서는 surface-dark 테두리)
- stats 없는 노선 카드는 변경 없음 (기존 sub 텍스트 그대로)

문제 있으면 fix 후 task 단위로 commit.

- [ ] **Step 4: prod migration 적용**

`/prod-update` 스킬 호출 → `scripts/prod_migration_20260516_bus_arrival_stats.sql`을 prod에 적용. 적용 후:

```bash
# 적용 검증
psql "$RAILWAY_POSTGRES_URL" -c "\d bus_arrival_stats"
```

- [ ] **Step 5: prod에서 첫 refresh 1회 수동 실행 (또는 다음날 03:30 잡 대기)**

Railway 컨테이너 shell 또는 로컬에서 prod DB URL로 실행 — 운영 가이드에 따라 결정. 빠른 검증을 원하면 prod 컨테이너에서 `refresh_all_stats` 1회 수동 호출.

- [ ] **Step 6: prod Redis 캐시 정리 (선택)**

스키마 변경 후 stale `bus:arrivals:*` 캐시가 stats를 머지하지 못한 상태로 남아 있을 수 있음 — `/prod-redis-clear` 스킬로 `bus` prefix만 flush.

- [ ] **Step 7: 최종 verification 보고**

verification-before-completion 스킬 가이드대로:
- 백엔드 테스트 `pytest backend/tests/services/test_bus_stats.py backend/tests/api/test_bus_arrival_stats_api.py -v` 결과 캡처
- 프론트 테스트 `cd frontend && npm test -- ArrivalDistributionBar BusStatsHeader BusArrivalCard` 결과 캡처
- UI 스크린샷 (카드 + 시트 헤더, 라이트/다크)

---

## Self-Review 결과

### Spec coverage
| Spec 섹션 | 대응 Task |
|---|---|
| §3.3 식별자 규약 (내부 PK) | Task 1, 2, 7, 8, 9 모두 일관 |
| §3.4 윈도우/임계/Outlier | Task 5 (`_REFRESH_SQL`) |
| §4 신규 테이블 | Task 1, 2 |
| §5.1 서비스 | Task 4, 5 |
| §5.2 Redis | Task 5, 15 |
| §5.3 APScheduler | Task 6, 15 |
| §5.4 API | Task 7, 8, 9 |
| §5.5 Pydantic | Task 3 |
| §6.1 신규 컴포넌트 | Task 10, 11 |
| §6.2 기존 수정 | Task 13, 14 |
| §6.3 훅 | Task 12 |
| §7 에러/엣지 | Task 4 (skip 임계), Task 10 (p10==p90, maxMin 클램프), Task 11 (null 가드), Task 13 (stats null fallback) |
| §8 테스트 | Task 4, 7, 10, 11, 13 |
| §9 변경 파일 | File Structure 표가 일치 |

### Placeholder 스캔
- TBD/TODO 없음
- "Add appropriate error handling" 류 없음
- 빈 step 없음
- 코드 블록이 모든 코드 step에 들어가 있음

### Type 일관성
- `route_id`, `stop_id` 모두 정수(`bus_routes.id`, `bus_stops.id`) — 백엔드·프론트 일관
- `stats` 페이로드 키: `tolerance_min, p10_min, p50_min, p90_min, mean_min, sample_size, computed_at` — Task 3, 5, 10, 11, 13에서 동일
- 컴포넌트 prop 이름 `p10Min/p50Min/p90Min` (PascalCase 후미) — Task 10, 11, 13에서 일관
