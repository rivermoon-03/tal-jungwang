-- 2026-08-03 정확도 배치 마이그레이션
-- A4 ETA 자가 채점(bus_eta_samples · bus_eta_accuracy) + A5 지하철 도착 이력(subway_arrival_history)
-- 근거: docs/2026-08-03-research-batch-implementation.md
-- 적용: 프로덕션 DB에 수동 실행. 순수 additive — 기존 테이블 무변경, 롤백은 DROP TABLE 3개.

BEGIN;

-- A4: ETA 자가 채점 오차 샘플 (수집기 detected 도착 판정 시 적재, 28일 보존)
-- error_sec = 실제도착 epoch − (관측시각 + 예측초). 양수 = 예측보다 늦게 도착.
-- 보존기간 정리는 retention.py가 아니라 03:47 집계 잡이 함께 수행한다.
CREATE TABLE IF NOT EXISTS bus_eta_samples (
    id           SERIAL       PRIMARY KEY,
    route_number VARCHAR(20)  NOT NULL,
    station_id   INTEGER      NOT NULL REFERENCES bus_stops(id) ON DELETE CASCADE,
    plate_no     VARCHAR(20)  NOT NULL,
    lead_sec     INTEGER      NOT NULL CHECK (lead_sec > 0),
    error_sec    INTEGER      NOT NULL,
    observed_at  TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bus_eta_samples_route_station_at
    ON bus_eta_samples (route_number, station_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_bus_eta_samples_observed_at
    ON bus_eta_samples (observed_at);

-- A4: (노선번호, 정류장) ETA 정확도 집계 — 매일 03:47 KST 재계산.
-- 표본 50 미만 조합은 행 미생성. within60_ratio = |error_sec| ≤ 60초 비율(0~1).
CREATE TABLE IF NOT EXISTS bus_eta_accuracy (
    route_number   VARCHAR(20)  NOT NULL,
    station_id     INTEGER      NOT NULL REFERENCES bus_stops(id) ON DELETE CASCADE,
    sample_size    INTEGER      NOT NULL CHECK (sample_size > 0),
    mae_sec        INTEGER      NOT NULL CHECK (mae_sec >= 0),
    bias_sec       INTEGER      NOT NULL,
    within60_ratio NUMERIC(4,3) NOT NULL CHECK (within60_ratio BETWEEN 0 AND 1),
    updated_at     TIMESTAMPTZ  NOT NULL,
    PRIMARY KEY (route_number, station_id)
);

-- A5: 지하철 실측 도착 이력 — 요일별 다이아 정본화(서해선·토요일)의 원료.
-- 폴링 경로에서 도착 확정 시에만 적재(폴링당 0~2건). 장기 보존.
CREATE TABLE IF NOT EXISTS subway_arrival_history (
    id           SERIAL       PRIMARY KEY,
    station_name VARCHAR(20)  NOT NULL,   -- 정왕|시흥시청|초지
    line_id      VARCHAR(10)  NOT NULL,   -- 1004|1075|1093 (서울 실시간 API subwayId)
    direction    VARCHAR(10)  NOT NULL,   -- 상행|하행
    train_no     VARCHAR(20)  NOT NULL,
    arrived_at   TIMESTAMPTZ  NOT NULL,
    day_type     VARCHAR(10)  NOT NULL    -- weekday|saturday|sunday
);

CREATE INDEX IF NOT EXISTS idx_subway_arrival_stn_line_day
    ON subway_arrival_history (station_name, line_id, direction, day_type, arrived_at);
CREATE INDEX IF NOT EXISTS idx_subway_arrival_arrived_at
    ON subway_arrival_history (arrived_at);

COMMIT;
