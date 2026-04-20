-- ============================================================
-- 정왕 교통 허브 — PostgreSQL 스키마 + 시드 데이터
-- 최종 수정: 2026-04-14
-- 모델 기준: backend/app/models/ 전체 반영
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. 초기화 (개발 환경에서만 사용)
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS bus_arrival_history         CASCADE;
DROP TABLE IF EXISTS subway_timetable_entries    CASCADE;
DROP TABLE IF EXISTS shuttle_timetable_entries   CASCADE;
DROP TABLE IF EXISTS shuttle_routes              CASCADE;
DROP TABLE IF EXISTS schedule_periods            CASCADE;
DROP TABLE IF EXISTS bus_timetable_entries       CASCADE;
DROP TABLE IF EXISTS bus_stop_routes             CASCADE;
DROP TABLE IF EXISTS bus_routes                  CASCADE;
DROP TABLE IF EXISTS bus_stops                   CASCADE;
DROP TABLE IF EXISTS traffic_history             CASCADE;
DROP TABLE IF EXISTS notices                     CASCADE;
DROP TABLE IF EXISTS app_links                   CASCADE;
DROP TABLE IF EXISTS app_info                    CASCADE;


-- ────────────────────────────────────────────────────────────
-- 1. bus_stops — 버스 정류장
-- ────────────────────────────────────────────────────────────
CREATE TABLE bus_stops (
    id               SERIAL       PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    gbis_station_id  VARCHAR(20)  UNIQUE,   -- NULL = 시간표 전용 정류장
    lat              NUMERIC(9,6) NOT NULL,
    lng              NUMERIC(9,6) NOT NULL
);

-- ────────────────────────────────────────────────────────────
-- 2. bus_routes — 버스 노선
-- ────────────────────────────────────────────────────────────
CREATE TABLE bus_routes (
    id              SERIAL       PRIMARY KEY,
    route_number    VARCHAR(20)  NOT NULL,
    route_name      VARCHAR(100),
    direction_name  VARCHAR(50),
    is_realtime     BOOLEAN      NOT NULL DEFAULT FALSE,
    gbis_route_id   VARCHAR(20)  UNIQUE    -- NULL = 시간표 전용 노선
);

-- ────────────────────────────────────────────────────────────
-- 3. bus_stop_routes — 정류장 ↔ 노선 M:M
-- ────────────────────────────────────────────────────────────
CREATE TABLE bus_stop_routes (
    bus_stop_id   INTEGER NOT NULL REFERENCES bus_stops(id)  ON DELETE CASCADE,
    bus_route_id  INTEGER NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
    PRIMARY KEY (bus_stop_id, bus_route_id)
);

-- ────────────────────────────────────────────────────────────
-- 4. bus_timetable_entries — 시간표 기반 버스 출발 시각
-- ────────────────────────────────────────────────────────────
CREATE TABLE bus_timetable_entries (
    id              SERIAL      PRIMARY KEY,
    route_id        INTEGER     NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
    stop_id         INTEGER     NOT NULL REFERENCES bus_stops(id),
    day_type        VARCHAR(10) NOT NULL CHECK (day_type IN ('weekday', 'saturday', 'sunday')),
    departure_time  TIME        NOT NULL,
    note            VARCHAR(100)
);

CREATE INDEX idx_bus_tt_route_stop_day
    ON bus_timetable_entries (route_id, stop_id, day_type);

-- ────────────────────────────────────────────────────────────
-- 5. bus_arrival_history — 실시간 버스 도착 이력
-- ────────────────────────────────────────────────────────────
CREATE TABLE bus_arrival_history (
    id          SERIAL       PRIMARY KEY,
    route_id    INTEGER      NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
    stop_id     INTEGER      NOT NULL REFERENCES bus_stops(id),
    plate_no    VARCHAR(20)  NOT NULL,
    arrived_at  TIMESTAMPTZ  NOT NULL,
    day_type    VARCHAR(10)  NOT NULL,
    source      VARCHAR(10)  NOT NULL DEFAULT 'detected'
);

CREATE INDEX idx_bus_arrival_route_stop_day
    ON bus_arrival_history (route_id, stop_id, day_type, arrived_at);

-- ────────────────────────────────────────────────────────────
-- 6. schedule_periods — 셔틀 운행 기간
-- ────────────────────────────────────────────────────────────
CREATE TABLE schedule_periods (
    id              SERIAL       PRIMARY KEY,
    period_type     VARCHAR(20)  NOT NULL
                    CHECK (period_type IN ('SEMESTER','VACATION','EXAM','HOLIDAY','SUSPENDED')),
    name            VARCHAR(100) NOT NULL,
    start_date      DATE         NOT NULL,
    end_date        DATE         NOT NULL,
    priority        INTEGER      NOT NULL DEFAULT 0,
    notice_message  VARCHAR(500),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 7. shuttle_routes — 셔틀 노선 (방면)
--    direction: 0=등교, 1=하교 (표시명 변환은 프론트엔드 담당)
-- ────────────────────────────────────────────────────────────
CREATE TABLE shuttle_routes (
    id           SERIAL    PRIMARY KEY,
    direction    SMALLINT  NOT NULL CHECK (direction IN (0, 1)),
    description  VARCHAR(255)
);

-- ────────────────────────────────────────────────────────────
-- 8. shuttle_timetable_entries — 셔틀 시간표
-- ────────────────────────────────────────────────────────────
CREATE TABLE shuttle_timetable_entries (
    id                  SERIAL      PRIMARY KEY,
    schedule_period_id  INTEGER     NOT NULL REFERENCES schedule_periods(id) ON DELETE CASCADE,
    shuttle_route_id    INTEGER     NOT NULL REFERENCES shuttle_routes(id)   ON DELETE CASCADE,
    day_type            VARCHAR(10) NOT NULL CHECK (day_type IN ('weekday', 'saturday', 'sunday')),
    departure_time      TIME        NOT NULL,
    note                VARCHAR(100)
);

CREATE INDEX idx_shuttle_tt_period_route_day
    ON shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type);

-- ────────────────────────────────────────────────────────────
-- 9. subway_timetable_entries — 지하철 시간표 (TAGO API로 갱신)
-- ────────────────────────────────────────────────────────────
CREATE TABLE subway_timetable_entries (
    id              SERIAL      PRIMARY KEY,
    direction       VARCHAR(10) NOT NULL
                    CHECK (direction IN ('up', 'down', 'line4_up', 'line4_down')),
    day_type        VARCHAR(10) NOT NULL CHECK (day_type IN ('weekday', 'saturday', 'sunday')),
    departure_time  TIME        NOT NULL,
    destination     VARCHAR(50) NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subway_tt_dir_day
    ON subway_timetable_entries (direction, day_type);

-- ────────────────────────────────────────────────────────────
-- 10. traffic_history — 도로 교통정보 이력 (주기적 수집)
-- ────────────────────────────────────────────────────────────
CREATE TABLE traffic_history (
    id               SERIAL        PRIMARY KEY,
    road_name        VARCHAR(50)   NOT NULL,
    direction        VARCHAR(15)   NOT NULL CHECK (direction IN ('to_station', 'to_school')),
    speed            NUMERIC(5,1)  NOT NULL,  -- km/h
    duration_seconds INTEGER       NOT NULL,
    distance_meters  INTEGER       NOT NULL,
    congestion       SMALLINT      NOT NULL CHECK (congestion BETWEEN 1 AND 4),
    collected_at     TIMESTAMPTZ   NOT NULL
);

CREATE INDEX idx_traffic_road_dir_time ON traffic_history (road_name, direction, collected_at);
CREATE INDEX idx_traffic_collected_at  ON traffic_history (collected_at);

-- ────────────────────────────────────────────────────────────
-- 11. notices — 공지사항
-- ────────────────────────────────────────────────────────────
CREATE TABLE notices (
    id          SERIAL       PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    content     TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 12. app_links — 앱 내 외부 링크 목록
-- ────────────────────────────────────────────────────────────
CREATE TABLE app_links (
    id          SERIAL       PRIMARY KEY,
    icon        VARCHAR(10)  NOT NULL,
    label       VARCHAR(100) NOT NULL,
    url         VARCHAR(500) NOT NULL,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ────────────────────────────────────────────────────────────
-- 13. app_info — 앱 메타 정보 (항상 id=1 단일 행)
-- ────────────────────────────────────────────────────────────
CREATE TABLE app_info (
    id           SERIAL       PRIMARY KEY,
    version      VARCHAR(20)  NOT NULL,
    description  TEXT,
    feedback_url VARCHAR(500),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ============================================================
-- SEED DATA
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- S1. 버스 정류장
--     정왕역: 수인분당선 정왕역 좌표 (CLAUDE.md 기준)
--     나머지: 근사값
-- ────────────────────────────────────────────────────────────
INSERT INTO bus_stops (name, gbis_station_id, lat, lng) VALUES
  ('시화 (3400 시종착)',            NULL,          37.314800, 126.806000),
  ('이마트 (6502·시흥1번 정류장)', '224000513',   37.340300, 126.728500),
  ('한국공학대학교',                '224000639',   37.339500, 126.733400),
  ('정왕역',                       NULL,          37.351618, 126.742747),
  ('사당역 14번 출구',              NULL,          37.476654, 126.982610),
  ('강남역 3400 정류장',            NULL,          37.498427, 127.029829);

-- ────────────────────────────────────────────────────────────
-- S2. 버스 노선
-- ────────────────────────────────────────────────────────────
INSERT INTO bus_routes (route_number, route_name, direction_name, is_realtime, gbis_route_id) VALUES
  ('3400',   '시화~강남역',   '강남역방면(시화출발)', FALSE, NULL),
  ('6502',   '이마트~사당역', '사당역방면',           FALSE, NULL),
  ('시흥33', '시흥33번',      NULL,                   TRUE,  '224000062'),
  ('20-1',   '시흥20-1번',    NULL,                   TRUE,  '224000023'),
  ('시흥1',  '시흥1번',       NULL,                   TRUE,  '213000006');

-- ────────────────────────────────────────────────────────────
-- S3. 정류장 ↔ 노선 연결
-- ────────────────────────────────────────────────────────────
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id)
SELECT s.id, r.id FROM bus_stops s, bus_routes r
WHERE (s.name = '시화 (3400 시종착)'             AND r.route_number = '3400')
   OR (s.name = '이마트 (6502·시흥1번 정류장)'   AND r.route_number = '6502')
   OR (s.name = '이마트 (6502·시흥1번 정류장)'   AND r.route_number = '시흥1')
   OR (s.name = '한국공학대학교'                  AND r.route_number = '시흥33')
   OR (s.name = '한국공학대학교'                  AND r.route_number = '20-1')
   OR (s.name = '사당역 14번 출구'                AND r.route_number = '6502')
   OR (s.name = '사당역 14번 출구'                AND r.route_number = '3400')
   OR (s.name = '강남역 3400 정류장'              AND r.route_number = '3400');

-- ────────────────────────────────────────────────────────────
-- S4. 버스 시간표 — 3400번
-- 출처: 버스_시간표.md § 2, 3
-- ────────────────────────────────────────────────────────────

-- ── 3400번 평일 시화 출발 (총 43편) ──────────────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('05:40'), ('06:00'), ('06:20'), ('06:35'), ('06:50'),
       ('07:10'), ('07:35'), ('08:00'), ('08:30'),
       ('09:00'), ('09:30'), ('10:00'), ('10:25'), ('10:50'),
       ('11:15'), ('11:40'), ('12:05'), ('12:30'),
       ('12:55'), ('13:20'), ('13:50'), ('14:15'), ('14:40'),
       ('15:05'), ('15:30'), ('15:55'), ('16:20'),
       ('16:45'), ('17:10'), ('17:40'), ('18:10'), ('18:40'),
       ('19:10'), ('19:35'), ('20:00'), ('20:25'),
       ('20:50'), ('21:15'), ('21:40'), ('22:05'), ('22:30'),
       ('22:55'), ('23:20')
     ) AS t(dt)
WHERE r.route_number = '3400'
  AND s.name = '시화 (3400 시종착)';

-- ── 3400번 토·일·공휴일 시화 출발 (총 37편) ─────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, d.day_type, t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES ('saturday'), ('sunday')) AS d(day_type),
     (VALUES
       ('05:40'), ('06:10'), ('06:40'), ('07:10'),
       ('07:40'), ('08:10'), ('08:35'), ('09:00'),
       ('09:25'), ('09:50'), ('10:15'), ('10:40'),
       ('11:10'), ('11:40'), ('12:05'), ('12:30'),
       ('13:00'), ('13:30'), ('14:00'), ('14:30'),
       ('15:00'), ('15:30'), ('16:00'), ('16:30'),
       ('17:05'), ('17:40'), ('18:15'), ('18:50'),
       ('19:20'), ('19:50'), ('20:20'), ('20:50'),
       ('21:20'), ('21:50'), ('22:20'), ('22:50'), ('23:20')
     ) AS t(dt)
WHERE r.route_number = '3400'
  AND s.name = '시화 (3400 시종착)';

-- ────────────────────────────────────────────────────────────
-- S5. 버스 시간표 — 6502번
-- 출처: 버스_시간표.md § 4 (이마트 출발 방향, 2023-12-18 개정)
-- ────────────────────────────────────────────────────────────

-- ── 6502번 평일 이마트 출발 → 사당역 (총 42편) ───────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('05:00'), ('05:30'), ('05:50'),
       ('06:10'), ('06:25'), ('06:40'), ('06:55'),
       ('07:10'), ('07:25'), ('07:40'),
       ('08:00'), ('08:20'), ('08:40'),
       ('09:00'), ('09:30'),
       ('10:00'), ('10:30'),
       ('11:00'), ('11:30'),
       ('12:00'), ('12:30'),
       ('13:00'), ('13:30'),
       ('14:30'),
       ('15:10'), ('15:40'),
       ('16:10'), ('16:30'), ('16:50'),
       ('17:10'), ('17:30'),
       ('18:00'), ('18:30'),
       ('19:00'), ('19:30'),
       ('20:00'), ('20:30'),
       ('21:00'), ('21:30'),
       ('22:00'), ('22:30')
     ) AS t(dt)
WHERE r.route_number = '6502'
  AND s.name = '이마트 (6502·시흥1번 정류장)';

-- ── 6502번 토·일·공휴일 이마트 출발 → 사당역 (총 28편) ──────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, d.day_type, t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES ('saturday'), ('sunday')) AS d(day_type),
     (VALUES
       ('05:30'),
       ('06:10'), ('06:50'),
       ('07:30'),
       ('08:10'), ('08:50'),
       ('09:30'),
       ('10:00'), ('10:30'),
       ('11:00'), ('11:40'),
       ('12:20'),
       ('13:00'), ('13:40'),
       ('14:20'),
       ('15:00'), ('15:40'),
       ('16:20'),
       ('17:00'), ('17:40'),
       ('18:20'),
       ('19:00'), ('19:40'),
       ('20:20'),
       ('21:00'), ('21:40'),
       ('22:10'), ('22:40')
     ) AS t(dt)
WHERE r.route_number = '6502'
  AND s.name = '이마트 (6502·시흥1번 정류장)';

-- ────────────────────────────────────────────────────────────
-- S5-2. 버스 시간표 — 3400번 강남 → 시화 (inbound)
-- 출처: 버스_시간표.md § 3400 평일 표의 `강남역` 컬럼
-- ────────────────────────────────────────────────────────────

-- ── 3400 평일 강남역 출발 → 시화 (43편) ─────────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('07:00'), ('07:30'), ('07:55'), ('08:15'), ('08:30'),
       ('08:50'), ('09:15'), ('09:40'), ('10:10'),
       ('10:35'), ('11:00'), ('11:30'), ('11:55'), ('12:20'),
       ('12:45'), ('13:10'), ('13:35'), ('14:00'),
       ('14:25'), ('14:50'), ('15:20'), ('15:45'), ('16:10'),
       ('16:40'), ('17:05'), ('17:30'), ('17:55'),
       ('18:20'), ('18:45'), ('19:10'), ('19:40'), ('20:10'),
       ('20:35'), ('21:00'), ('21:25'), ('21:50'),
       ('22:15'), ('22:40'), ('23:05'), ('23:30'), ('23:50'),
       ('00:10'), ('00:30')
     ) AS t(dt)
WHERE r.route_number = '3400'
  AND s.name = '강남역 3400 정류장';

-- ── 3400 평일 사당역 14번 출구 전세버스 2편 ─────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time, note)
SELECT r.id, s.id, 'weekday', t.dt::TIME, '전세버스'
FROM bus_routes r, bus_stops s,
     (VALUES ('19:00'), ('19:30')) AS t(dt)
WHERE r.route_number = '3400'
  AND s.name = '사당역 14번 출구';

-- (3400 휴일 강남 출발 자료 없음 — placeholder UI 처리)

-- ────────────────────────────────────────────────────────────
-- S5-3. 버스 시간표 — 6502번 사당 → 이마트 (inbound)
-- 출처: 버스_시간표.md § 6502 사당역 14번 출구 출발
-- ────────────────────────────────────────────────────────────

-- ── 6502 평일 사당 출발 → 이마트 (39편) ─────────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('06:00'), ('06:30'), ('06:55'),
       ('07:20'), ('07:35'), ('07:50'),
       ('08:10'), ('08:50'),
       ('09:10'), ('09:30'), ('09:50'),
       ('10:10'), ('10:35'),
       ('11:05'), ('11:30'),
       ('12:00'), ('12:30'),
       ('13:00'), ('13:30'),
       ('14:00'), ('14:30'),
       ('15:30'),
       ('16:10'), ('16:40'),
       ('17:15'), ('17:40'),
       ('18:00'), ('18:20'), ('18:35'),
       ('19:05'), ('19:35'),
       ('20:00'), ('20:25'), ('20:55'),
       ('21:25'), ('21:50'),
       ('22:20'), ('22:50'),
       ('23:20')
     ) AS t(dt)
WHERE r.route_number = '6502'
  AND s.name = '사당역 14번 출구';

-- ── 6502 토·일·공휴일 사당 출발 → 이마트 (28편) ─────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, d.day_type, t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES ('saturday'), ('sunday')) AS d(day_type),
     (VALUES
       ('06:30'),
       ('07:10'), ('07:50'),
       ('08:30'),
       ('09:10'), ('09:55'),
       ('10:35'),
       ('11:10'), ('11:40'),
       ('12:10'), ('12:50'),
       ('13:30'),
       ('14:10'), ('14:50'),
       ('15:30'),
       ('16:05'), ('16:45'),
       ('17:25'),
       ('18:05'), ('18:40'),
       ('19:15'), ('19:55'),
       ('20:35'),
       ('21:15'), ('21:55'),
       ('22:35'),
       ('23:05'), ('23:30')
     ) AS t(dt)
WHERE r.route_number = '6502'
  AND s.name = '사당역 14번 출구';

-- ────────────────────────────────────────────────────────────
-- S6. 셔틀 노선 (0=등교, 1=하교)
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_routes (direction, description) VALUES
  (0, '정왕역 출발 → 한국공학대학교/경기과학기술대학교 (등교)'),
  (1, '한국공학대학교 본교 → 정왕역 (하교)');

-- ────────────────────────────────────────────────────────────
-- S7. 셔틀 운행 기간
-- ────────────────────────────────────────────────────────────
INSERT INTO schedule_periods (period_type, name, start_date, end_date, priority) VALUES
  ('SEMESTER', '2026학년도 1학기', '2026-03-03', '2026-06-22', 1);

-- ────────────────────────────────────────────────────────────
-- S8. 셔틀 시간표 — 학교 출발 → 정왕역 (하교 direction=1, 평일, 학기 중)
-- 출처: 버스_시간표.md § 1
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries
    (schedule_period_id, shuttle_route_id, day_type, departure_time, note)
SELECT p.id, r.id, 'weekday', t.dt::TIME, t.note
FROM schedule_periods p, shuttle_routes r,
     (VALUES
       ('09:00', NULL), ('09:20', NULL), ('09:40', NULL),
       ('10:00', NULL), ('10:05', NULL), ('10:10', NULL),
       ('10:20', NULL), ('10:40', NULL), ('10:50', NULL),
       ('11:00', NULL), ('11:10', NULL), ('11:20', NULL),
       ('11:40', NULL), ('11:50', NULL),
       ('12:00', NULL), ('12:10', NULL), ('12:20', NULL),
       ('12:40', NULL), ('12:50', NULL),
       ('13:00', NULL), ('13:10', NULL), ('13:20', NULL),
       ('13:40', NULL), ('13:50', NULL),
       ('14:00', NULL), ('14:10', NULL), ('14:30', NULL), ('14:50', NULL),
       ('15:00', NULL), ('15:10', NULL), ('15:30', NULL), ('15:50', NULL),
       ('16:10', NULL), ('16:20', NULL), ('16:30', NULL),
       ('16:40', NULL), ('16:50', NULL),
       ('17:00', '수시운행'), ('17:10', '수시운행'), ('17:20', '수시운행'),
       ('17:30', '수시운행'), ('17:40', '수시운행'), ('17:50', '수시운행'),
       ('18:00', NULL), ('18:10', NULL), ('18:20', NULL),
       ('18:30', NULL), ('18:40', NULL), ('18:50', NULL),
       ('19:05', NULL), ('19:15', NULL), ('19:30', NULL), ('19:45', NULL),
       ('20:05', NULL), ('20:25', NULL), ('20:45', NULL),
       ('21:00', NULL), ('21:20', NULL), ('21:48', NULL),
       ('22:10', NULL), ('22:40', NULL)
     ) AS t(dt, note)
WHERE p.name = '2026학년도 1학기'
  AND r.direction = 1;

-- ────────────────────────────────────────────────────────────
-- S9. 셔틀 시간표 — 정왕역 출발 → 학교 (등교 direction=0, 평일, 학기 중)
-- 출처: 버스_시간표.md § (등교편)
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries
    (schedule_period_id, shuttle_route_id, day_type, departure_time, note)
SELECT p.id, r.id, 'weekday', t.dt::TIME, t.note
FROM schedule_periods p, shuttle_routes r,
     (VALUES
       ('08:40', '수시운행'), ('08:50', '수시운행'), ('09:00', '수시운행'),
       ('09:10', '수시운행'), ('09:20', '수시운행'), ('09:30', '수시운행'),
       ('09:40', '수시운행'), ('09:50', '수시운행'), ('10:00', '수시운행'),
       ('10:10', NULL), ('10:15', NULL), ('10:20', NULL),
       ('10:30', NULL), ('10:50', NULL),
       ('11:00', NULL), ('11:10', NULL), ('11:20', NULL),
       ('11:30', NULL), ('11:50', NULL),
       ('12:00', NULL), ('12:10', NULL), ('12:20', NULL),
       ('12:30', NULL), ('12:50', NULL),
       ('13:00', NULL), ('13:10', NULL), ('13:20', NULL),
       ('13:30', NULL), ('13:50', NULL),
       ('14:00', NULL), ('14:10', NULL), ('14:20', NULL), ('14:40', NULL),
       ('15:00', NULL), ('15:10', NULL), ('15:20', NULL), ('15:40', NULL),
       ('16:00', NULL), ('16:20', NULL), ('16:30', NULL),
       ('16:40', NULL), ('16:50', NULL),
       ('17:10', '회차편 · 학교 수시운행 출발'),
       ('18:10', '회차편 · 학교 18:00 출발'),
       ('18:20', '회차편 · 학교 18:10 출발'),
       ('18:30', '회차편 · 학교 18:20 출발'),
       ('18:40', '회차편 · 학교 18:30 출발'),
       ('18:50', '회차편 · 학교 18:40 출발'),
       ('19:00', '회차편 · 학교 18:50 출발'),
       ('19:15', '회차편 · 학교 19:05 출발'),
       ('19:25', '회차편 · 학교 19:15 출발'),
       ('19:40', '회차편 · 학교 19:30 출발'),
       ('19:55', '회차편 · 학교 19:45 출발'),
       ('20:15', '회차편 · 학교 20:05 출발'),
       ('20:35', '회차편 · 학교 20:25 출발'),
       ('20:55', '회차편 · 학교 20:45 출발'),
       ('21:10', '회차편 · 학교 21:00 출발'),
       ('21:30', '회차편 · 학교 21:20 출발'),
       ('21:58', '회차편 · 학교 21:48 출발'),
       ('22:17', '막차')
     ) AS t(dt, note)
WHERE p.name = '2026학년도 1학기'
  AND r.direction = 0;

-- ────────────────────────────────────────────────────────────
-- S10. 지하철 시간표
-- subway_timetable_entries 는 POST /api/v1/admin/subway/refresh 로 갱신
-- ────────────────────────────────────────────────────────────
-- (비워둠 — 배포 후 admin API 첫 실행 시 채워짐)

-- ────────────────────────────────────────────────────────────
-- S11. 앱 메타 정보 (id=1 고정 — admin API가 db.get(AppInfoModel, 1) 로 조회)
-- ────────────────────────────────────────────────────────────
INSERT INTO app_info (id, version, description, feedback_url) VALUES
  (1, '1.0.0', '정왕 교통 허브 — 한국공학대학교·경기과학기술대학교 통합 교통 정보', NULL);


-- ============================================================
-- Alembic version stamping
-- schema.sql로 직접 생성했으므로 migrate.py가 중복 실행하지 않도록 head로 고정
-- ============================================================
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    PRIMARY KEY (version_num)
);
INSERT INTO alembic_version (version_num) VALUES ('0009_traffic_history')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 초기화 후 실행 순서
-- 1. docker compose down -v && docker compose up -d
--    (postgres가 이 파일을 자동 실행 → 스키마 + 시드 + alembic stamping)
-- 2. 서버 기동 시 지하철 시간표 자동 로드 (main.py lifespan)
-- ============================================================
