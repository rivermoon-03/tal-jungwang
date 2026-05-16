# 통계학적 버스 도착 예측 (Distribution Bar 시안)

작성일: 2026-05-16
대상: 정왕 교통 허브 (tal-jungwang)
영역: backend (`app/services/bus_stats.py` 신규, `app/services/bus.py`, `app/api/bus.py`, `app/models/bus.py`, `app/schemas/bus.py`, `app/core/scheduler.py`), frontend (`components/bus/`, `components/schedule/ScheduleDetailModal.jsx`, `hooks/useBus.js`), DB (`scripts/prod_migration_20260516_bus_arrival_stats.sql`, `scripts/schema.sql`)

---

## 1. 문제 / 목표

### 1.1 배경
프로덕션 DB에 약 한 달 분량의 `bus_arrival_history` 데이터가 누적되었다. 현재 사용자는 GBIS 실시간 도착(`predictTimeSec`)이나 시간표만 본다 — "이 시간대에 이 노선이 평소 얼마나 변동성이 있는지"라는 분포 정보를 받지 못한다.

### 1.2 목표
추적 대상 노선(시흥33·20-1·시흥1·11-A·5200·99-2·3401·5602 등)에 한해, 사용자에게:
- 메인 도착 카드에 "보통 ±N분"이라는 신뢰구간 보조 표시
- 노선 상세 시트에 "이 시간대의 도착 간격 분포(p10~p90 + 중앙값)"를 시각화한 헤더 박스

를 제공해, GBIS 실시간 신호의 신뢰감을 보강하고 사용자가 "지금 안 잡으면 다음 차가 언제쯤일지" 직관적으로 알 수 있게 한다.

### 1.3 비목표
- **비추적 노선(시간표만 있는 노선)의 도착 예측**: `bus_arrival_history`에 데이터가 없으므로 별도 플랜으로 분리. 이번 변경은 추적 (route, stop) 페어 한정.
- 셔틀·지하철은 변경 범위 밖.
- GBIS 예측 자체를 통계로 대체하지 않음 — GBIS 실시간은 그대로 메인 신호, 통계는 부가.

---

## 2. 현 파이프라인 (분석)

### 2.1 데이터
- **`bus_arrival_history`** (`scripts/schema.sql:89-100`): `route_id, stop_id, plate_no, arrived_at TIMESTAMPTZ, day_type, source`. 인덱스 `(route_id, stop_id, day_type, arrived_at)`. APScheduler `_bus_poll_job`이 GBIS 응답 변화 기준으로 적재.
- 추적 (route, stop) 페어는 CLAUDE.md 표 기준 ~14개. 4주치 인접 도착 수만 합쳐도 충분히 분위수가 의미 있는 표본 크기 확보.

### 2.2 현재 사용자 표시
- 메인 카드 `BusArrivalCard` (`frontend/src/components/bus/BusArrivalCard.jsx`): 단일 row, ETA + sub("다음 +N분")
- 상세 시트 `BusHistoryContent` (`frontend/src/components/schedule/ScheduleDetailModal.jsx:469-568`): 날짜별 컬럼에 도착 시각(HH:MM) 리스트, 현재 시각 이후 첫 도착이 파란 하이라이트
- 통계적 처리는 없음. 평균 배차 간격(`_compute_avg_interval`)만 존재하며 시간표 기반.

---

## 3. 설계 결정

### 3.1 큰 그림
**실시간 × 통계 하이브리드 (브레인스토밍 옵션 B)** + **Distribution Bar UI (시안 C)**.
- 통계는 사전 집계 테이블 + Redis 캐시. 매일 새벽 1회 갱신.
- 메인 카드는 GBIS 실시간을 그대로 메인 ETA로 두고, 보조 텍스트만 "보통 ±N분"으로 교체.
- 상세 시트는 헤더 박스에 큰 분포 바 + p10/중앙값/p90 라벨.

### 3.2 분포의 정의
**같은 (route, stop, day_type, hour_of_day) 버킷의 "인접 도착 간격(seconds between consecutive arrivals)"의 분포.**
사용자가 임의 시각에 정류장에 도착했을 때 다음 버스까지의 기다림과 자연스럽게 대응되며, 배차 변동성을 직접적으로 보여준다.

### 3.3 식별자 규약
이 문서의 모든 `route_id` / `stop_id`는 **DB 내부 PK 정수** (`bus_routes.id`, `bus_stops.id`)다. 외부 GBIS 식별자는 별도로 `bus_routes.gbis_route_id` (문자열) 컬럼에 보관되어 있으며 본 기능에서는 사용하지 않는다. 프론트엔드가 신규 엔드포인트를 호출할 때는 `/arrivals/...` 응답에 이미 포함된 내부 `route_id`/`stop_id`를 그대로 사용한다.

### 3.4 윈도우 / 임계 / Outlier 컷
| 항목 | 값 | 이유 |
|---|---|---|
| 데이터 윈도우 | 최근 28일 | 정확히 4주차 확보, 계절성 변화 영향 최소 |
| 시간 윈도우 | `hour_of_day` 1시간 버킷 | 24개 버킷 × 3 day_type — 운영 시간대 충분 |
| 최소 표본 | `n ≥ 8` | 미만이면 row 생성 안 함 → UI fallback |
| 간격 하한 컷 | 30s | GBIS 중복 적재/노이즈 제거 |
| 간격 상한 컷 | 60min | 휴지 시간(02~04시 폴링 off, 운행 종료) 제거 |
| 분위수 | p10, p50, p90 | 시안 C 요구사항. PostgreSQL `PERCENTILE_CONT` |

---

## 4. DB 변경

### 4.1 신규 테이블 — `bus_arrival_stats`

```sql
CREATE TABLE IF NOT EXISTS bus_arrival_stats (
  route_id INTEGER NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
  stop_id INTEGER NOT NULL REFERENCES bus_stops(id) ON DELETE CASCADE,
  day_type TEXT NOT NULL CHECK (day_type IN ('weekday','saturday','sunday')),
  hour_of_day SMALLINT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  p10_interval_sec INTEGER NOT NULL,
  p50_interval_sec INTEGER NOT NULL,
  p90_interval_sec INTEGER NOT NULL,
  mean_interval_sec INTEGER NOT NULL,
  sample_size INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, stop_id, day_type, hour_of_day)
);
```

- 카디널리티: 추적 ~14 페어 × 3 × 24 ≈ 1,000 row 상한. 인덱스 추가 불필요 (PK가 곧 lookup 키).
- 마이그레이션: `scripts/prod_migration_20260516_bus_arrival_stats.sql` (db-infra 스킬 담당).
- `scripts/schema.sql`에 동일 DDL 동기화.

### 4.2 SQLAlchemy 모델
`backend/app/models/bus.py`에 `BusArrivalStats` 추가 (async, mapped_column 스타일은 기존 모델과 일치).

---

## 5. 백엔드 변경

### 5.1 신규 서비스 — `backend/app/services/bus_stats.py`

함수 시그니처:
```python
async def get_arrival_stats(
    session: AsyncSession,
    route_id: int,
    stop_id: int,
    day_type: str,
    hour: int,
) -> ArrivalStatsDict | None:
    """Redis 캐시 → DB lookup. 없으면 None."""

async def refresh_all_stats(session: AsyncSession) -> dict:
    """집계 CTE 실행 → UPSERT → Redis 키 invalidation. 반환은 {updated, skipped, duration_ms} 등 통계."""
```

집계 CTE (refresh_all_stats 내부):
```sql
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
SELECT route_id, stop_id, day_type, hod, p10, p50, p90, mean, n, now()
FROM agg
ON CONFLICT (route_id, stop_id, day_type, hour_of_day) DO UPDATE
SET p10_interval_sec = EXCLUDED.p10_interval_sec,
    p50_interval_sec = EXCLUDED.p50_interval_sec,
    p90_interval_sec = EXCLUDED.p90_interval_sec,
    mean_interval_sec = EXCLUDED.mean_interval_sec,
    sample_size = EXCLUDED.sample_size,
    computed_at = EXCLUDED.computed_at;
```

표본이 8 미만으로 떨어진 버킷은 **유지가 아니라 삭제**가 깔끔하다. UPSERT 직후 `DELETE FROM bus_arrival_stats WHERE computed_at < <잡 시작 시각>` 한 번 실행 — 이번 round에 채워지지 않은 옛 row를 모두 정리한다 (잡 시작 시각은 transaction 진입 직전 캡처).

### 5.2 Redis 캐시

| 키 | TTL | 값 |
|---|---|---|
| `bus:stats:{route_id}:{stop_id}:{day_type}:{hour}` | 6h | JSON `{p10_min, p50_min, p90_min, mean_min, tolerance_min, n, computed_at}` |

- `*_min` 필드는 `round(sec / 60)` (UI는 분 단위로만 표시)
- `tolerance_min = round((p90_min - p10_min) / 2)` — 카드 보조 텍스트 직접 사용
- `refresh_all_stats` 끝에서 `bus:stats:*` 전체 SCAN+DEL (양이 1000개 미만이라 부담 없음)

### 5.3 APScheduler 잡

`backend/app/core/scheduler.py`에 `_bus_arrival_stats_refresh_job` 추가:
- 트리거: `CronTrigger(hour=3, minute=30, timezone='Asia/Seoul')` — 버스 폴링 off 시간(02:00~03:59)을 살짝 넘긴 안전한 시각, traffic 수집과도 안 겹침
- 락: 인스턴스 단일 실행 (`max_instances=1`)
- 에러 시 Discord 웹훅 로그 (`core/discord_logging.py` 재사용)

### 5.4 API 변경

#### 5.4.1 기존 확장 — `GET /api/v1/bus/arrivals/{station_id}`
각 arrival 항목에 `stats` 키 inline 머지 (있을 때만 — 키 자체 생략으로 페이로드 정리):
```json
{
  "route_no": "시흥33",
  "route_id": 12,
  "arrival_type": "realtime",
  "arrive_in_seconds": 180,
  "crowded": 2,
  "stats": {
    "tolerance_min": 4,
    "p10_min": 1,
    "p50_min": 4,
    "p90_min": 9,
    "mean_min": 4,
    "sample_size": 28
  }
}
```
머지 위치: `backend/app/services/bus.py::get_arrivals()` 안, 기존 `avg_interval_minutes` 부착 직후. 1회 호출에 stats lookup은 메모리 캐시(Redis)라 N+1 부담 없음.

#### 5.4.2 신규 — `GET /api/v1/bus/arrival-stats/{route_id}/{stop_id}`
시트 헤더가 별도 요청할 때 쓰는 단일 lookup. 쿼리 파라미터 `hour`, `day_type` 옵션 — 기본은 현재 KST 시각/요일 도출. 데이터 없으면 `{"stats": null, ...}` + 200.

### 5.5 Pydantic 스키마
`backend/app/schemas/bus.py`에 `ArrivalStats` 추가. 기존 `ArrivalOut`에 `stats: ArrivalStats | None = None` 필드 추가.

---

## 6. 프론트엔드 변경

### 6.1 신규 컴포넌트

#### 6.1.1 `frontend/src/components/bus/ArrivalDistributionBar.jsx`
```jsx
// props: { p10Min, p50Min, p90Min, variant: 'mini' | 'full', maxMin?: number }
// variant='mini': 8px 높이, 라벨 없음
// variant='full': 14px 높이 + p10/중앙값/p90 라벨
// maxMin 기본 20 (p90 > 20이면 동적 확장 + "+20분" 표시)
```
디자인 토큰:
- 바 배경: `bg-slate-100 dark:bg-surface-dark-alt`
- p10~p90 영역: `bg-accent/30` (full은 `linear-gradient` 옅게 → 진하게 → 옅게)
- 중앙값 도트: `bg-accent border-2 border-white dark:border-surface-dark shadow-sm`

#### 6.1.2 `frontend/src/components/bus/BusStatsHeader.jsx`
```jsx
// props: { stats, dayLabel, hourLabel }
// stats == null → return null (자리도 차지 X)
// 내부: 큰 "약 N분" + Distribution Bar(full) + 표본수
```
상세 시트 진입 시 `BusHistoryContent`의 최상단에 배치.

### 6.2 기존 컴포넌트 수정

#### 6.2.1 `BusArrivalCard.jsx`
- `computeDisplay()`에 `stats` 인자 추가. 기존 sub 로직은:
  - stats 있으면 `eta-sub` = `"보통 ±${tolerance_min}분"`
  - stats 없으면 기존 `다음 +N분` 유지
- 카드 row 아래에 stats 있을 때만 `<ArrivalDistributionBar variant="mini" />` 렌더 (padding `0 12px 10px 12px`)
- 카드 높이가 18px 증가 — 모바일 list scroll 영향 검토(허용)

#### 6.2.2 `ScheduleDetailModal.jsx > BusHistoryContent`
- 컴포넌트 본문 최상단에 `<BusStatsHeader stats={stats} dayLabel={...} hourLabel={...} />` 삽입 (현재의 "실시간 GBIS 기반 노선..." 안내문 위)
- stats는 `useBusArrivalStats(routeNumber → routeId, stopId)` 훅에서 받음 (route_number → route_id 매핑은 기존 history-preview 응답에 이미 stop_id가 있어 활용)

#### 6.2.3 `BusTimetableDetail.jsx`
- 동일하게 `<BusStatsHeader />` 본문 상단 추가.

### 6.3 신규 훅

`frontend/src/hooks/useBus.js`에 추가:
```js
export function useBusArrivalStats(routeId, stopId) {
  return useApi(
    routeId && stopId ? `/bus/arrival-stats/${routeId}/${stopId}` : null,
    { staleMs: 5 * 60_000 }  // 5분 stale
  )
}
```
SWR 패턴(`useApi` 기존 활용). 메인 카드는 별도 호출 없이 `useArrivals` 응답에서 stats inline.

### 6.4 Tailwind 토큰 추가
`frontend/tailwind.config.js`의 `surface-dark-alt`가 이미 존재한다면 그대로. 없으면 `surface-dark`의 한 톤 밝은 색(`#141414` 같은) 추가.

---

## 7. 에러 · 엣지 케이스

| 상황 | 동작 |
|---|---|
| `stats == null` (표본 < 8, 또는 비추적 페어) | 카드/헤더 모두 통계 영역 미렌더, 기존 UI로 자연 fallback |
| `p10_min == p90_min` (변동성 0) | 분포 바 폭 0 → CSS `min-width: 4px` 적용해 도트만 보이게 |
| `p90_min > 20` (long-tail) | `maxMin = p90 + 2`로 동적 확장, 라벨 "+N분"으로 강조 |
| GBIS 다운 (실시간 없음) | stats는 GBIS와 독립 → 카드 sub "보통 ±N분"은 그대로 유지, 메인 ETA만 시간표/공란 |
| `refresh_all_stats` 잡 실패 | Discord 알림 + `computed_at`이 24h 이상 stale인 row는 응답에 포함하되 백엔드 로그 경고 |
| 잡 실행 중 (03:30~03:40) | UPSERT 단위라 부분 갱신, 사용자 영향 없음 |
| 추적 페어가 새로 추가됨 (seed 변경) | 다음날 03:30 잡에서 자연 포함, 그전엔 stats 없음 → UI fallback |
| 카드 row 높이 증가로 인한 list 깨짐 | dashboard `ArrivalRow` 등 mini 차트 사용 경로 사전 확인, 깨짐 있으면 `variant='mini'` 옵션 off |

---

## 8. 테스트

### 8.1 백엔드
- `backend/tests/services/test_bus_stats.py` (신규)
  - 픽스처: 가짜 `bus_arrival_history` 28일치 (한 (route, stop, weekday, 18시) 버킷에 도착 30건 삽입, 간격 분포 알려진 값)
  - `refresh_all_stats()` 후 stats 테이블 row 검증 — p10/p50/p90 수치, sample_size = 30
  - 표본 7건짜리 버킷은 row 생성 안 됨 확인
  - outlier 컷 (간격 10초/2시간) 제거 확인
- `backend/tests/api/test_bus_arrivals_stats.py` (신규)
  - `/arrivals/{station}` 응답에 stats 머지 (추적 페어), 미머지 (비추적)
  - `/arrival-stats/{route}/{stop}` 200 + null stats, 200 + present stats 두 케이스

### 8.2 프론트엔드
- `frontend/src/components/bus/ArrivalDistributionBar.test.jsx` (신규)
  - mini/full variant 렌더, p10==p90 엣지, maxMin 클램프
- `frontend/src/components/bus/BusArrivalCard.test.jsx` (기존 보강)
  - arrivals[0]에 stats 있을 때 sub 텍스트가 "보통 ±N분" 변경 확인
  - stats 없을 때 기존 "다음 +N분" 유지 확인
- `frontend/src/components/bus/BusStatsHeader.test.jsx` (신규)
  - stats=null → returns null

### 8.3 수동 verification
verification-before-completion 스킬에 따라:
1. `/prod-sync`로 prod 데이터 로컬 복제
2. 로컬에서 `refresh_all_stats()` 1회 실행 → psql로 row 직접 검증
3. dev server (`vite`) 띄우고 시흥33 카드 → 시트 흐름 실제 클릭 확인
4. 카드 row 높이 변화로 인한 list/dashboard 영향 사전 점검
5. 다크모드 토글 시 분포 바 색상 토큰 적용 확인

---

## 9. 변경 파일 요약

### 신규
- `scripts/prod_migration_20260516_bus_arrival_stats.sql`
- `backend/app/services/bus_stats.py`
- `backend/app/models/bus.py` (BusArrivalStats class 추가)
- `backend/tests/services/test_bus_stats.py`
- `backend/tests/api/test_bus_arrivals_stats.py`
- `frontend/src/components/bus/ArrivalDistributionBar.jsx` (+test)
- `frontend/src/components/bus/BusStatsHeader.jsx` (+test)

### 수정
- `scripts/schema.sql` (DDL 동기화)
- `backend/app/services/bus.py` (get_arrivals에 stats 머지)
- `backend/app/api/bus.py` (arrival-stats 엔드포인트 추가)
- `backend/app/schemas/bus.py` (ArrivalStats 추가, ArrivalOut 확장)
- `backend/app/core/scheduler.py` (_bus_arrival_stats_refresh_job 추가)
- `frontend/src/components/bus/BusArrivalCard.jsx` (sub 텍스트 + mini bar)
- `frontend/src/components/bus/BusTimetableDetail.jsx` (BusStatsHeader 삽입)
- `frontend/src/components/schedule/ScheduleDetailModal.jsx` (BusHistoryContent 최상단 BusStatsHeader)
- `frontend/src/hooks/useBus.js` (useBusArrivalStats 추가)
- `CLAUDE.md`의 Redis 캐시 키 표에 `bus:stats:*` 추가
- `frontend/tailwind.config.js` (필요 시 surface-dark-alt 토큰)

---

## 10. 후속 (이번 범위 밖)

- 비추적 노선까지 통계 적용 → 먼저 history 적재 시작 필요. 별도 spec.
- "지금 시각 기준 다음 도착까지 대기 시간" 분포 (현재는 인접 간격) — 데이터 더 모인 후 정확도 비교.
- 요일별 비교 미니 차트 (시안 D 요소) — 사용자 반응 보고 2차 도입.
