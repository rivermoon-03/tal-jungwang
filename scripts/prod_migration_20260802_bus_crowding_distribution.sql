-- 혼잡도 표시 기준 재설계 (docs/superpowers/specs/2026-08-02-bus-crowding-thresholds-design.md)
--
-- 1. bus_crowding_stats 에 등급별 표본 수(c1..c4) 추가
--    표시 기준을 avg_crowded 에서 "혼잡(>=3) 비율"로 바꾸기 위한 분포. 평균은 하한이
--    1이라 값 1인 버스와 3인 버스가 섞이면 2("보통")가 되어 실제로 존재한 어떤 버스도
--    설명하지 못한다. NULL 허용으로 추가하며 첫 나이틀리(03:35 KST)가 채운다.
--
-- 2. bus_crowding_calibrations 신설
--    GBIS 값이 현장과 어긋나는 조합의 표시 하한. 원천 로그·사전집계는 건드리지 않고
--    표시 시점에만 적용한다.
--
-- 반복 실행해도 결과가 같다.

BEGIN;

ALTER TABLE bus_crowding_stats ADD COLUMN IF NOT EXISTS c1 INTEGER;
ALTER TABLE bus_crowding_stats ADD COLUMN IF NOT EXISTS c2 INTEGER;
ALTER TABLE bus_crowding_stats ADD COLUMN IF NOT EXISTS c3 INTEGER;
ALTER TABLE bus_crowding_stats ADD COLUMN IF NOT EXISTS c4 INTEGER;

CREATE TABLE IF NOT EXISTS bus_crowding_calibrations (
    id           SERIAL       PRIMARY KEY,
    bus_route_id INTEGER      NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
    bus_stop_id  INTEGER      REFERENCES bus_stops(id) ON DELETE CASCADE,
    day_type     VARCHAR(10)  CHECK (day_type IN ('weekday','weekend')),
    hour_from    SMALLINT     NOT NULL CHECK (hour_from BETWEEN 0 AND 23),
    hour_to      SMALLINT     NOT NULL CHECK (hour_to BETWEEN 0 AND 23),
    min_level    SMALLINT     NOT NULL CHECK (min_level BETWEEN 1 AND 4),
    reason       TEXT         NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (hour_to >= hour_from)
);

CREATE INDEX IF NOT EXISTS idx_crowding_calibration_route
    ON bus_crowding_calibrations (bus_route_id, bus_stop_id);

-- 시흥1 하교 · 이마트 승차 · 평일 16~19시.
-- 현장 관측은 이마트 도착 시점에 이미 만차인데 GBIS 는 17시 91.2%, 18시 98.0% 를
-- 값 1로 준다. 해당 차량들이 3~4 를 보고할 능력은 있다(모든 차량에 max 3~4 기록 존재).
INSERT INTO bus_crowding_calibrations
    (bus_route_id, bus_stop_id, day_type, hour_from, hour_to, min_level, reason)
SELECT r.id, s.id, 'weekday', 16, 19, 3,
       '현장 관측: 이마트 도착 시점 이미 만차. GBIS 91~98%가 값 1로 미반영(2026-08-02 확인)'
FROM bus_routes r
CROSS JOIN bus_stops s
WHERE r.route_number = '시흥1' AND r.category = '하교'
  AND s.gbis_station_id = '224000513'
  AND NOT EXISTS (
      SELECT 1 FROM bus_crowding_calibrations c
      WHERE c.bus_route_id = r.id AND c.bus_stop_id = s.id
        AND c.day_type = 'weekday' AND c.hour_from = 16 AND c.hour_to = 19
  );

COMMIT;
