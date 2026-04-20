-- ============================================================
-- 정왕 교통 허브 — PostgreSQL 스키마 + 시드 데이터
-- 최종 수정: 2026-04-20
-- 모델 기준: backend/app/models/ 전체 반영
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. 초기화 (개발 환경에서만 사용)
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS bus_arrival_history         CASCADE;
DROP TABLE IF EXISTS bus_crowding_logs           CASCADE;
DROP TABLE IF EXISTS subway_timetable_entries    CASCADE;
DROP TABLE IF EXISTS shuttle_timetable_entries   CASCADE;
DROP TABLE IF EXISTS shuttle_routes              CASCADE;
DROP TABLE IF EXISTS schedule_periods            CASCADE;
DROP TABLE IF EXISTS bus_timetable_entries       CASCADE;
DROP TABLE IF EXISTS bus_stop_routes             CASCADE;
DROP TABLE IF EXISTS map_marker_routes           CASCADE;
DROP TABLE IF EXISTS map_markers                 CASCADE;
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
    id               SERIAL        PRIMARY KEY,
    name             VARCHAR(100)  NOT NULL,
    gbis_station_id  VARCHAR(20)   UNIQUE,        -- NULL = 시간표 전용 정류장
    lat              NUMERIC(9,6)  NOT NULL,
    lng              NUMERIC(9,6)  NOT NULL,
    sub_name         VARCHAR(100)                  -- 부가 설명 (예: "14번 출구")
);

-- ────────────────────────────────────────────────────────────
-- 2. bus_routes — 버스 노선
--    같은 route_number가 direction_name이 다른 두 행으로 저장됨
--    (서울행 / 학교행 분리)
--    category: '하교'(정왕→서울) | '등교'(서울→정왕)
-- ────────────────────────────────────────────────────────────
CREATE TABLE bus_routes (
    id              SERIAL        PRIMARY KEY,
    route_number    VARCHAR(20)   NOT NULL,
    route_name      VARCHAR(100)
                    CHECK (route_name IS NULL OR length(route_name) > 0),
    direction_name  VARCHAR(50),
    gbis_route_id   VARCHAR(20),                   -- NULL이면 시간표 전용; NOT NULL이면 실시간
    category        VARCHAR(20)   NOT NULL DEFAULT '하교'
                    CHECK (category IN ('하교', '등교')),
    CONSTRAINT uq_bus_routes_number_category UNIQUE (route_number, category)
);

-- ────────────────────────────────────────────────────────────
-- 3. bus_stop_routes — 정류장 ↔ 노선 M:M
-- ────────────────────────────────────────────────────────────
CREATE TABLE bus_stop_routes (
    bus_stop_id   INTEGER NOT NULL REFERENCES bus_stops(id)  ON DELETE CASCADE,
    bus_route_id  INTEGER NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
    PRIMARY KEY (bus_stop_id, bus_route_id)
);

CREATE INDEX idx_bus_stop_routes_route ON bus_stop_routes (bus_route_id);

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
-- 6. bus_crowding_logs — 버스 혼잡도 이력
-- ────────────────────────────────────────────────────────────
CREATE TABLE bus_crowding_logs (
    id                SERIAL       PRIMARY KEY,
    route_id          INTEGER      NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
    stop_id           INTEGER      NOT NULL REFERENCES bus_stops(id),
    plate_no          VARCHAR(20)  NOT NULL,
    crowded           INTEGER      NOT NULL,
    arrive_in_seconds INTEGER      NOT NULL,
    recorded_at       TIMESTAMPTZ  NOT NULL
);

CREATE INDEX idx_crowding_route_stop_at
    ON bus_crowding_logs (route_id, stop_id, recorded_at);

-- ────────────────────────────────────────────────────────────
-- 7. schedule_periods — 셔틀 운행 기간
-- ────────────────────────────────────────────────────────────
CREATE TABLE schedule_periods (
    id              SERIAL       PRIMARY KEY,
    period_type     VARCHAR(20)  NOT NULL
                    CHECK (period_type IN ('SEMESTER','VACATION','EXAM','HOLIDAY','SUSPENDED')),
    name            VARCHAR(100) NOT NULL,
    start_date      DATE         NOT NULL,
    end_date        DATE         NOT NULL CHECK (end_date >= start_date),
    priority        INTEGER      NOT NULL DEFAULT 0,
    notice_message  VARCHAR(500),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedule_periods_dates ON schedule_periods (start_date, end_date);

-- ────────────────────────────────────────────────────────────
-- 8. shuttle_routes — 셔틀 노선 (방면)
--    direction: 0=등교, 1=하교
-- ────────────────────────────────────────────────────────────
CREATE TABLE shuttle_routes (
    id           SERIAL    PRIMARY KEY,
    direction    SMALLINT  NOT NULL CHECK (direction IN (0, 1)),
    description  VARCHAR(255)
);

-- ────────────────────────────────────────────────────────────
-- 9. shuttle_timetable_entries — 셔틀 시간표
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
-- 10. subway_timetable_entries — 지하철 시간표 (admin API로 갱신)
-- ────────────────────────────────────────────────────────────
CREATE TABLE subway_timetable_entries (
    id              SERIAL      PRIMARY KEY,
    direction       VARCHAR(10) NOT NULL
                    CHECK (direction IN ('up', 'down', 'line4_up', 'line4_down', 'choji_up', 'choji_dn', 'siheung_up', 'siheung_dn')),
    day_type        VARCHAR(10) NOT NULL CHECK (day_type IN ('weekday', 'saturday', 'sunday')),
    departure_time  TIME        NOT NULL,
    destination     VARCHAR(50) NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subway_tt_dir_day
    ON subway_timetable_entries (direction, day_type);

-- ────────────────────────────────────────────────────────────
-- 11. traffic_history — 도로 교통정보 이력
-- ────────────────────────────────────────────────────────────
CREATE TABLE traffic_history (
    id               SERIAL        PRIMARY KEY,
    road_name        VARCHAR(50)   NOT NULL,
    direction        VARCHAR(15)   NOT NULL CHECK (direction IN ('to_station', 'to_school')),
    speed            NUMERIC(5,1)  NOT NULL,
    duration_seconds INTEGER       NOT NULL,
    distance_meters  INTEGER       NOT NULL,
    congestion       SMALLINT      NOT NULL CHECK (congestion BETWEEN 1 AND 4),
    collected_at     TIMESTAMPTZ   NOT NULL
);

CREATE INDEX idx_traffic_road_dir_time ON traffic_history (road_name, direction, collected_at);
CREATE INDEX idx_traffic_collected_at  ON traffic_history (collected_at);

-- ────────────────────────────────────────────────────────────
-- 12. map_markers — 지도 마커 정의
--    marker_type: 'shuttle' | 'subway' | 'bus' | 'bus_seoul' | 'seohae'
-- ────────────────────────────────────────────────────────────
CREATE TABLE map_markers (
    id            SERIAL        PRIMARY KEY,
    marker_key    VARCHAR(50)   NOT NULL UNIQUE,
    marker_type   VARCHAR(20)   NOT NULL,
    display_name  VARCHAR(50)   NOT NULL,
    lat           NUMERIC(9,6)  NOT NULL,
    lng           NUMERIC(9,6)  NOT NULL,
    sort_order    INTEGER       NOT NULL DEFAULT 0,
    ui_meta       JSONB         NOT NULL DEFAULT '{}',
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE
);

-- ────────────────────────────────────────────────────────────
-- 13. map_marker_routes — 마커 ↔ 노선 연결
-- ────────────────────────────────────────────────────────────
CREATE TABLE map_marker_routes (
    id                SERIAL        PRIMARY KEY,
    marker_id         INTEGER       NOT NULL REFERENCES map_markers(id) ON DELETE CASCADE,
    route_number      VARCHAR(20)   NOT NULL,
    route_color       VARCHAR(10),
    badge_text        VARCHAR(10),
    outbound_stop_id  INTEGER       REFERENCES bus_stops(id),
    inbound_stop_id   INTEGER       REFERENCES bus_stops(id),
    ui_meta           JSONB         NOT NULL DEFAULT '{}',
    sort_order        INTEGER       NOT NULL DEFAULT 0
);

CREATE INDEX idx_map_marker_routes_marker ON map_marker_routes (marker_id);

-- ────────────────────────────────────────────────────────────
-- 14. notices — 공지사항
-- ────────────────────────────────────────────────────────────
CREATE TABLE notices (
    id          SERIAL       PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    content     TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notices_updated_at
BEFORE UPDATE ON notices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 15. app_links — 앱 내 외부 링크
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
-- 16. app_info — 앱 메타 정보 (id=1 단일 행)
-- ────────────────────────────────────────────────────────────
CREATE TABLE app_info (
    id                        SERIAL       PRIMARY KEY,
    version                   VARCHAR(20)  NOT NULL,
    description               TEXT,
    feedback_url              VARCHAR(500),
    subway_last_refreshed_at  TIMESTAMPTZ,
    updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ============================================================
-- SEED DATA
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- S1. 버스 정류장
-- ────────────────────────────────────────────────────────────
INSERT INTO bus_stops (name, gbis_station_id, lat, lng, sub_name) VALUES
  ('시화',             NULL,          37.314800, 126.806000, NULL),
  ('이마트',           '224000513',   37.340300, 126.728500, NULL),
  ('한국공학대학교',   '224000639',   37.339500, 126.733400, NULL),
  ('정왕역',           NULL,          37.351618, 126.742747, NULL),
  ('사당역',           NULL,          37.476654, 126.982610, '14번 출구'),
  ('강남역',           NULL,          37.498427, 127.029829, NULL),
  ('석수역',           NULL,          37.434876, 126.902779, NULL),
  ('구로디지털단지역', NULL,          37.485300, 126.901000, NULL);

-- ────────────────────────────────────────────────────────────
-- S2. 버스 노선
--    같은 route_number 두 행 = 서울행(하교) + 학교행(등교) 분리
-- ────────────────────────────────────────────────────────────
INSERT INTO bus_routes (route_number, route_name, direction_name, gbis_route_id, category) VALUES
  -- 실시간 (GBIS): gbis_route_id NOT NULL = 실시간 활성
  ('시흥33', '시흥33번',   '시흥시청방면',       '224000062', '하교'),
  ('20-1',   '시흥20-1번', '아이파크아파트방면', '224000011', '하교'),
  ('시흥1',  '시흥1번',    '신천역방면',         '213000006', '하교'),
  ('11-A',   '시흥11-A번', '정왕역방면',          '224000036', '하교'),
  -- 시간표 전용 — 방향별 2행 (gbis_route_id NULL)
  ('3400', NULL, '서울행', NULL, '하교'),
  ('3400', NULL, '학교행', NULL, '등교'),
  ('3401', NULL, '서울행', NULL, '하교'),
  ('3401', NULL, '학교행', NULL, '등교'),
  ('5602', '5602번', '구로디지털단지역방면', NULL, '하교'),
  ('5602', '5602번', '학교행',             NULL, '등교'),
  ('6502', NULL, '서울행', NULL, '하교'),
  ('6502', NULL, '학교행', NULL, '등교');

-- ────────────────────────────────────────────────────────────
-- S3. 정류장 ↔ 노선 연결
-- ────────────────────────────────────────────────────────────
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id)
SELECT s.id, r.id FROM bus_stops s, bus_routes r WHERE
    -- 실시간 노선 (한국공학대학교 정류장)
    (s.name = '한국공학대학교' AND r.route_number = '시흥33')
 OR (s.name = '한국공학대학교' AND r.route_number = '20-1')
 OR (s.name = '한국공학대학교' AND r.route_number = '11-A')
    -- 시흥1: 이마트 정류장
 OR (s.name = '이마트' AND r.route_number = '시흥1')
    -- 3400: 시화(서울행), 강남역(학교행)
 OR (s.name = '시화'   AND r.route_number = '3400' AND r.category = '하교')
 OR (s.name = '강남역' AND r.route_number = '3400' AND r.category = '등교')
    -- 3401: 이마트(서울행), 석수역(학교행)
 OR (s.name = '이마트' AND r.route_number = '3401' AND r.category = '하교')
 OR (s.name = '석수역' AND r.route_number = '3401' AND r.category = '등교')
    -- 5602: 이마트(서울행), 구로디지털단지역(학교행)
 OR (s.name = '이마트'           AND r.route_number = '5602' AND r.category = '하교')
 OR (s.name = '구로디지털단지역' AND r.route_number = '5602' AND r.category = '등교')
    -- 6502: 이마트(서울행), 사당역(학교행)
 OR (s.name = '이마트' AND r.route_number = '6502' AND r.category = '하교')
 OR (s.name = '사당역' AND r.route_number = '6502' AND r.category = '등교');

-- ────────────────────────────────────────────────────────────
-- S4. 버스 시간표 — 3400번
-- ────────────────────────────────────────────────────────────

-- ── 3400 평일 시화 출발 → 강남(서울행, 43편) ─────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('05:40'),('06:00'),('06:20'),('06:35'),('06:50'),
       ('07:10'),('07:35'),('08:00'),('08:30'),
       ('09:00'),('09:30'),('10:00'),('10:25'),('10:50'),
       ('11:15'),('11:40'),('12:05'),('12:30'),
       ('12:55'),('13:20'),('13:50'),('14:15'),('14:40'),
       ('15:05'),('15:30'),('15:55'),('16:20'),
       ('16:45'),('17:10'),('17:40'),('18:10'),('18:40'),
       ('19:10'),('19:35'),('20:00'),('20:25'),
       ('20:50'),('21:15'),('21:40'),('22:05'),('22:30'),
       ('22:55'),('23:20')
     ) AS t(dt)
WHERE r.route_number = '3400' AND r.category = '하교'
  AND s.name = '시화';

-- ── 3400 토·일 시화 출발 (37편) ──────────────────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, d.day_type, t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES ('saturday'),('sunday')) AS d(day_type),
     (VALUES
       ('05:40'),('06:10'),('06:40'),('07:10'),
       ('07:40'),('08:10'),('08:35'),('09:00'),
       ('09:25'),('09:50'),('10:15'),('10:40'),
       ('11:10'),('11:40'),('12:05'),('12:30'),
       ('13:00'),('13:30'),('14:00'),('14:30'),
       ('15:00'),('15:30'),('16:00'),('16:30'),
       ('17:05'),('17:40'),('18:15'),('18:50'),
       ('19:20'),('19:50'),('20:20'),('20:50'),
       ('21:20'),('21:50'),('22:20'),('22:50'),('23:20')
     ) AS t(dt)
WHERE r.route_number = '3400' AND r.category = '하교'
  AND s.name = '시화';

-- ── 3400 평일 강남역 출발 → 시화(학교행, 43편) ───────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('07:00'),('07:30'),('07:55'),('08:15'),('08:30'),
       ('08:50'),('09:15'),('09:40'),('10:10'),
       ('10:35'),('11:00'),('11:30'),('11:55'),('12:20'),
       ('12:45'),('13:10'),('13:35'),('14:00'),
       ('14:25'),('14:50'),('15:20'),('15:45'),('16:10'),
       ('16:40'),('17:05'),('17:30'),('17:55'),
       ('18:20'),('18:45'),('19:10'),('19:40'),('20:10'),
       ('20:35'),('21:00'),('21:25'),('21:50'),
       ('22:15'),('22:40'),('23:05'),('23:30'),('23:50'),
       ('00:10'),('00:30')
     ) AS t(dt)
WHERE r.route_number = '3400' AND r.category = '등교'
  AND s.name = '강남역';

-- ────────────────────────────────────────────────────────────
-- S5. 버스 시간표 — 6502번
-- ────────────────────────────────────────────────────────────

-- ── 6502 평일 이마트 출발 → 사당역(서울행, 41편) ─────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('05:00'),('05:30'),('05:50'),
       ('06:10'),('06:25'),('06:40'),('06:55'),
       ('07:10'),('07:25'),('07:40'),
       ('08:00'),('08:20'),('08:40'),
       ('09:00'),('09:30'),
       ('10:00'),('10:30'),
       ('11:00'),('11:30'),
       ('12:00'),('12:30'),
       ('13:00'),('13:30'),
       ('14:30'),
       ('15:10'),('15:40'),
       ('16:10'),('16:30'),('16:50'),
       ('17:10'),('17:30'),
       ('18:00'),('18:30'),
       ('19:00'),('19:30'),
       ('20:00'),('20:30'),
       ('21:00'),('21:30'),
       ('22:00'),('22:30')
     ) AS t(dt)
WHERE r.route_number = '6502' AND r.category = '하교'
  AND s.name = '이마트';

-- ── 6502 토·일 이마트 출발 (28편) ────────────────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, d.day_type, t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES ('saturday'),('sunday')) AS d(day_type),
     (VALUES
       ('05:30'),
       ('06:10'),('06:50'),
       ('07:30'),
       ('08:10'),('08:50'),
       ('09:30'),
       ('10:00'),('10:30'),
       ('11:00'),('11:40'),
       ('12:20'),
       ('13:00'),('13:40'),
       ('14:20'),
       ('15:00'),('15:40'),
       ('16:20'),
       ('17:00'),('17:40'),
       ('18:20'),
       ('19:00'),('19:40'),
       ('20:20'),
       ('21:00'),('21:40'),
       ('22:10'),('22:40')
     ) AS t(dt)
WHERE r.route_number = '6502' AND r.category = '하교'
  AND s.name = '이마트';

-- ── 6502 평일 사당역 출발 → 이마트(학교행, 39편) ─────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('06:00'),('06:30'),('06:55'),
       ('07:20'),('07:35'),('07:50'),
       ('08:10'),('08:50'),
       ('09:10'),('09:30'),('09:50'),
       ('10:10'),('10:35'),
       ('11:05'),('11:30'),
       ('12:00'),('12:30'),
       ('13:00'),('13:30'),
       ('14:00'),('14:30'),
       ('15:30'),
       ('16:10'),('16:40'),
       ('17:15'),('17:40'),
       ('18:00'),('18:20'),('18:35'),
       ('19:05'),('19:35'),
       ('20:00'),('20:25'),('20:55'),
       ('21:25'),('21:50'),
       ('22:20'),('22:50'),
       ('23:20')
     ) AS t(dt)
WHERE r.route_number = '6502' AND r.category = '등교'
  AND s.name = '사당역';

-- ── 6502 토·일 사당역 출발 (28편) ────────────────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, d.day_type, t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES ('saturday'),('sunday')) AS d(day_type),
     (VALUES
       ('06:30'),
       ('07:10'),('07:50'),
       ('08:30'),
       ('09:10'),('09:55'),
       ('10:35'),
       ('11:10'),('11:40'),
       ('12:10'),('12:50'),
       ('13:30'),
       ('14:10'),('14:50'),
       ('15:30'),
       ('16:05'),('16:45'),
       ('17:25'),
       ('18:05'),('18:40'),
       ('19:15'),('19:55'),
       ('20:35'),
       ('21:15'),('21:55'),
       ('22:35'),
       ('23:05'),('23:30')
     ) AS t(dt)
WHERE r.route_number = '6502' AND r.category = '등교'
  AND s.name = '사당역';

-- ────────────────────────────────────────────────────────────
-- S6. 버스 시간표 — 3401번
-- ────────────────────────────────────────────────────────────

-- ── 3401 평일 이마트 출발 → 석수역(서울행, 30편) ─────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('05:30'),('06:00'),('06:30'),('07:00'),
       ('07:25'),('07:50'),('08:25'),('09:05'),('09:40'),
       ('10:20'),('10:55'),('11:30'),('12:05'),('12:40'),
       ('13:15'),('13:50'),('14:30'),('15:10'),('15:45'),
       ('16:20'),('17:00'),('17:20'),('17:45'),('18:20'),
       ('19:00'),('19:40'),('20:15'),('20:50'),('21:25'),
       ('22:00')
     ) AS t(dt)
WHERE r.route_number = '3401' AND r.category = '하교'
  AND s.name = '이마트';

-- ── 3401 토·일 이마트 출발 (23편) ────────────────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, d.day_type, t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES ('saturday'),('sunday')) AS d(day_type),
     (VALUES
       ('05:30'),('06:10'),('06:50'),('07:30'),
       ('08:10'),('08:50'),('09:30'),('10:10'),('10:50'),
       ('11:30'),('12:10'),('12:50'),('13:30'),('14:10'),
       ('14:50'),('15:30'),('16:10'),('17:30'),('18:10'),
       ('19:00'),('19:50'),('20:40'),('21:30')
     ) AS t(dt)
WHERE r.route_number = '3401' AND r.category = '하교'
  AND s.name = '이마트';

-- ── 3401 평일 석수역 출발 → 이마트(학교행, 31편) ─────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('06:30'),('07:00'),('07:40'),('08:15'),('08:45'),
       ('09:10'),('09:40'),('10:10'),('10:40'),('11:20'),
       ('11:55'),('12:30'),('13:05'),('13:40'),('14:15'),
       ('14:50'),('15:30'),('16:15'),('16:50'),('17:10'),
       ('17:30'),('18:10'),('18:30'),('18:55'),('19:25'),
       ('20:00'),('20:40'),('21:15'),('21:50'),('22:25'),
       ('23:00')
     ) AS t(dt)
WHERE r.route_number = '3401' AND r.category = '등교'
  AND s.name = '석수역';

-- ── 3401 토·일 석수역 출발 (23편) ────────────────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, d.day_type, t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES ('saturday'),('sunday')) AS d(day_type),
     (VALUES
       ('06:35'),('07:15'),('07:55'),('08:35'),('09:15'),
       ('09:55'),('10:35'),('11:15'),('11:55'),('12:35'),
       ('13:15'),('13:55'),('14:35'),('15:15'),('15:55'),
       ('16:35'),('17:35'),('18:35'),('19:15'),('20:05'),
       ('20:50'),('21:40'),('22:30')
     ) AS t(dt)
WHERE r.route_number = '3401' AND r.category = '등교'
  AND s.name = '석수역';

-- ────────────────────────────────────────────────────────────
-- S7. 버스 시간표 — 5602번
-- ────────────────────────────────────────────────────────────

-- ── 5602 평일 이마트 출발 → 구로디지털(서울행, 52편) ──────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('05:30'),('05:45'),('06:00'),('06:15'),('06:30'),
       ('06:45'),('07:00'),('07:20'),('07:40'),('08:00'),
       ('08:20'),('08:40'),('09:00'),('09:20'),('09:40'),
       ('10:00'),('10:20'),('10:40'),('11:00'),('11:20'),
       ('11:40'),('12:00'),('12:20'),('12:40'),('13:00'),
       ('13:20'),('13:40'),('14:00'),('14:20'),('14:40'),
       ('15:00'),('15:20'),('15:40'),('16:00'),('16:20'),
       ('16:40'),('17:00'),('17:20'),('17:40'),('18:00'),
       ('18:15'),('18:30'),('18:45'),('19:00'),('19:20'),
       ('19:40'),('20:10'),('20:40'),('21:10'),('21:40'),
       ('22:10'),('22:40')
     ) AS t(dt)
WHERE r.route_number = '5602' AND r.category = '하교'
  AND s.name = '이마트';

-- ── 5602 토·일 이마트 출발 (38편) ────────────────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, d.day_type, t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES ('saturday'),('sunday')) AS d(day_type),
     (VALUES
       ('05:30'),('05:55'),('06:20'),('06:45'),
       ('07:10'),('07:35'),('08:00'),('08:25'),('08:50'),
       ('09:15'),('09:40'),('10:05'),('10:30'),('10:55'),
       ('11:20'),('11:45'),('12:15'),('12:45'),('13:15'),
       ('13:45'),('14:15'),('14:45'),('15:15'),('15:45'),
       ('16:15'),('16:45'),('17:15'),('17:45'),('18:15'),
       ('18:45'),('19:10'),('19:40'),('20:10'),('20:40'),
       ('21:10'),('21:40'),('22:10'),('22:40')
     ) AS t(dt)
WHERE r.route_number = '5602' AND r.category = '하교'
  AND s.name = '이마트';

-- ── 5602 평일 구로디지털 출발 → 이마트(학교행, 52편) ──────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('06:30'),('06:45'),('07:00'),('07:20'),('07:40'),
       ('08:00'),('08:20'),('08:40'),('09:00'),('09:20'),
       ('09:40'),('10:00'),('10:20'),('10:40'),('11:00'),
       ('11:20'),('11:40'),('12:00'),('12:20'),('12:40'),
       ('13:00'),('13:20'),('13:40'),('14:00'),('14:20'),
       ('14:40'),('15:00'),('15:20'),('15:40'),('16:00'),
       ('16:20'),('16:40'),('17:00'),('17:20'),('17:40'),
       ('18:00'),('18:20'),('18:40'),('19:00'),('19:20'),
       ('19:40'),('20:00'),('20:20'),('20:40'),('21:00'),
       ('21:20'),('21:40'),('22:00'),('22:20'),('22:40'),
       ('23:00'),('23:20')
     ) AS t(dt)
WHERE r.route_number = '5602' AND r.category = '등교'
  AND s.name = '구로디지털단지역';

-- ── 5602 토·일 구로디지털 출발 (38편) ────────────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, d.day_type, t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES ('saturday'),('sunday')) AS d(day_type),
     (VALUES
       ('07:00'),('07:30'),('07:55'),('08:20'),('08:45'),
       ('09:10'),('09:35'),('10:00'),('10:25'),('10:50'),
       ('11:20'),('11:45'),('12:10'),('12:35'),('13:00'),
       ('13:25'),('13:50'),('14:15'),('14:40'),('15:05'),
       ('15:30'),('15:55'),('16:20'),('16:45'),('17:10'),
       ('17:35'),('18:00'),('18:25'),('18:50'),('19:15'),
       ('19:40'),('20:05'),('20:30'),('20:55'),('21:20'),
       ('21:45'),('22:10'),('22:35')
     ) AS t(dt)
WHERE r.route_number = '5602' AND r.category = '등교'
  AND s.name = '구로디지털단지역';

-- ────────────────────────────────────────────────────────────
-- S8. 버스 시간표 — 시흥33/20-1/시흥1 (실시간 노선 시간표 fallback)
-- ────────────────────────────────────────────────────────────

-- ── 시흥33 평일 한국공학대학교 (60편) ────────────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('06:12'),('06:30'),('06:46'),('07:02'),('07:18'),
       ('07:26'),('07:42'),('07:48'),('08:00'),('08:20'),
       ('08:38'),('08:50'),('09:02'),('09:14'),('09:30'),
       ('09:42'),('09:54'),('10:12'),('10:26'),('10:36'),
       ('10:56'),('11:12'),('11:24'),('11:42'),('11:54'),
       ('12:08'),('12:26'),('12:54'),('13:10'),('13:24'),
       ('13:42'),('13:58'),('14:12'),('14:24'),('14:40'),
       ('14:56'),('15:14'),('15:26'),('15:38'),('16:14'),
       ('16:30'),('16:44'),('17:00'),('17:20'),('17:38'),
       ('17:48'),('18:16'),('18:32'),('19:12'),('19:30'),
       ('19:48'),('20:04'),('20:14'),('20:26'),('20:40'),
       ('20:56'),('21:08'),('21:26'),('21:38'),('21:50')
     ) AS t(dt)
WHERE r.route_number = '시흥33'
  AND s.name = '한국공학대학교';

-- ── 20-1 평일 한국공학대학교 (22편) ──────────────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('06:12'),('07:24'),('07:54'),('08:40'),('09:00'),
       ('09:40'),('10:24'),('10:54'),('11:08'),('11:30'),
       ('12:28'),('12:54'),('13:28'),('14:04'),('14:28'),
       ('15:52'),('16:22'),('16:48'),('18:58'),('20:36'),
       ('20:54'),('21:48')
     ) AS t(dt)
WHERE r.route_number = '20-1'
  AND s.name = '한국공학대학교';

-- ── 시흥1 평일 이마트 (92편) ─────────────────────────────────
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time)
SELECT r.id, s.id, 'weekday', t.dt::TIME
FROM bus_routes r, bus_stops s,
     (VALUES
       ('06:12'),('06:18'),('06:30'),('06:44'),('06:48'),
       ('06:56'),('07:06'),('07:18'),('07:28'),('07:36'),
       ('07:46'),('07:54'),('08:00'),('08:10'),('08:28'),
       ('08:30'),('08:46'),('08:58'),('09:10'),('09:18'),
       ('09:30'),('09:40'),('09:52'),('10:04'),('10:18'),
       ('10:26'),('10:42'),('10:50'),('11:00'),('11:10'),
       ('11:20'),('11:28'),('11:36'),('11:44'),('11:52'),
       ('12:04'),('12:14'),('12:22'),('12:30'),('12:42'),
       ('12:46'),('12:52'),('13:02'),('13:14'),('13:34'),
       ('13:42'),('13:48'),('13:58'),('14:10'),('14:18'),
       ('14:26'),('14:46'),('14:52'),('15:04'),('15:14'),
       ('15:34'),('15:46'),('15:54'),('16:04'),('16:14'),
       ('16:20'),('16:34'),('16:44'),('17:04'),('17:18'),
       ('17:26'),('17:40'),('17:52'),('18:04'),('18:10'),
       ('18:22'),('18:30'),('18:40'),('18:52'),('19:00'),
       ('19:10'),('19:24'),('19:34'),('19:42'),('19:54'),
       ('20:04'),('20:16'),('20:26'),('20:36'),('20:44'),
       ('20:52'),('21:04'),('21:14'),('21:24'),('21:34'),
       ('21:38'),('21:48')
     ) AS t(dt)
WHERE r.route_number = '시흥1'
  AND s.name = '이마트';

-- ────────────────────────────────────────────────────────────
-- S9. 셔틀 노선
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_routes (direction, description) VALUES
  (0, '정왕역 출발 → 한국공학대학교/경기과학기술대학교 (등교)'),
  (1, '한국공학대학교 본교 → 정왕역 (하교)');

-- ────────────────────────────────────────────────────────────
-- S10. 셔틀 운행 기간
-- ────────────────────────────────────────────────────────────
INSERT INTO schedule_periods (period_type, name, start_date, end_date, priority) VALUES
  ('SEMESTER', '2026학년도 1학기', '2026-03-03', '2026-06-22', 1);

-- ────────────────────────────────────────────────────────────
-- S11. 셔틀 시간표 — 학교 → 정왕역 (하교 direction=1, 평일)
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries
    (schedule_period_id, shuttle_route_id, day_type, departure_time, note)
SELECT p.id, r.id, 'weekday', t.dt::TIME, t.note
FROM schedule_periods p, shuttle_routes r,
     (VALUES
       ('09:00',NULL),('09:20',NULL),('09:40',NULL),
       ('10:00',NULL),('10:05',NULL),('10:10',NULL),
       ('10:20',NULL),('10:40',NULL),('10:50',NULL),
       ('11:00',NULL),('11:10',NULL),('11:20',NULL),
       ('11:40',NULL),('11:50',NULL),
       ('12:00',NULL),('12:10',NULL),('12:20',NULL),
       ('12:40',NULL),('12:50',NULL),
       ('13:00',NULL),('13:10',NULL),('13:20',NULL),
       ('13:40',NULL),('13:50',NULL),
       ('14:00',NULL),('14:10',NULL),('14:30',NULL),('14:50',NULL),
       ('15:00',NULL),('15:10',NULL),('15:30',NULL),('15:50',NULL),
       ('16:10',NULL),('16:20',NULL),('16:30',NULL),
       ('16:40',NULL),('16:50',NULL),
       ('17:00','수시운행'),('17:10','수시운행'),('17:20','수시운행'),
       ('17:30','수시운행'),('17:40','수시운행'),('17:50','수시운행'),
       ('18:00',NULL),('18:10',NULL),('18:20',NULL),
       ('18:30',NULL),('18:40',NULL),('18:50',NULL),
       ('19:05',NULL),('19:15',NULL),('19:30',NULL),('19:45',NULL),
       ('20:05',NULL),('20:25',NULL),('20:45',NULL),
       ('21:00',NULL),('21:20',NULL),('21:48',NULL),
       ('22:10',NULL),('22:40',NULL)
     ) AS t(dt, note)
WHERE p.name = '2026학년도 1학기'
  AND r.direction = 1;

-- ────────────────────────────────────────────────────────────
-- S12. 셔틀 시간표 — 정왕역 → 학교 (등교 direction=0, 평일)
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries
    (schedule_period_id, shuttle_route_id, day_type, departure_time, note)
SELECT p.id, r.id, 'weekday', t.dt::TIME, t.note
FROM schedule_periods p, shuttle_routes r,
     (VALUES
       ('08:40','수시운행'),('08:50','수시운행'),('09:00','수시운행'),
       ('09:10','수시운행'),('09:20','수시운행'),('09:30','수시운행'),
       ('09:40','수시운행'),('09:50','수시운행'),('10:00','수시운행'),
       ('10:10',NULL),('10:15',NULL),('10:20',NULL),
       ('10:30',NULL),('10:50',NULL),
       ('11:00',NULL),('11:10',NULL),('11:20',NULL),
       ('11:30',NULL),('11:50',NULL),
       ('12:00',NULL),('12:10',NULL),('12:20',NULL),
       ('12:30',NULL),('12:50',NULL),
       ('13:00',NULL),('13:10',NULL),('13:20',NULL),
       ('13:30',NULL),('13:50',NULL),
       ('14:00',NULL),('14:10',NULL),('14:20',NULL),('14:40',NULL),
       ('15:00',NULL),('15:10',NULL),('15:20',NULL),('15:40',NULL),
       ('16:00',NULL),('16:20',NULL),('16:30',NULL),
       ('16:40',NULL),('16:50',NULL),
       ('17:10','회차편 · 학교 수시운행 출발'),
       ('18:10','회차편 · 학교 18:00 출발'),
       ('18:20','회차편 · 학교 18:10 출발'),
       ('18:30','회차편 · 학교 18:20 출발'),
       ('18:40','회차편 · 학교 18:30 출발'),
       ('18:50','회차편 · 학교 18:40 출발'),
       ('19:00','회차편 · 학교 18:50 출발'),
       ('19:15','회차편 · 학교 19:05 출발'),
       ('19:25','회차편 · 학교 19:15 출발'),
       ('19:40','회차편 · 학교 19:30 출발'),
       ('19:55','회차편 · 학교 19:45 출발'),
       ('20:15','회차편 · 학교 20:05 출발'),
       ('20:35','회차편 · 학교 20:25 출발'),
       ('20:55','회차편 · 학교 20:45 출발'),
       ('21:10','회차편 · 학교 21:00 출발'),
       ('21:30','회차편 · 학교 21:20 출발'),
       ('21:58','회차편 · 학교 21:48 출발'),
       ('22:17','막차')
     ) AS t(dt, note)
WHERE p.name = '2026학년도 1학기'
  AND r.direction = 0;

-- ────────────────────────────────────────────────────────────
-- S13. 지하철 시간표
-- subway_timetable_entries는 POST /api/v1/admin/subway/refresh 로 갱신
-- (비워둠 — 배포 후 admin API 첫 실행 시 채워짐)
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- S14. 지도 마커
-- ────────────────────────────────────────────────────────────
INSERT INTO map_markers (marker_key, marker_type, display_name, lat, lng, sort_order) VALUES
  ('shuttle_to_school',   'shuttle',   '등교',             37.351134, 126.742043,  10),
  ('shuttle_from_school', 'shuttle',   '하교',             37.339343, 126.732790,  20),
  ('jeongwang_station',   'subway',    '정왕역',           37.352618, 126.742747,  30),
  ('tec_bus_stop',        'bus',       '한국공대',         37.341633, 126.731252,  40),
  ('bus_hub_jw_sihwa',    'bus_seoul', '3400',             37.342546, 126.735365,  50),
  ('bus_hub_jw_emart',    'bus_seoul', '이마트',           37.345999, 126.737995,  60),
  ('bus_hub_sl_gangnam',  'bus_seoul', '강남역',           37.498427, 127.029829,  70),
  ('bus_hub_sl_sadang',   'bus_seoul', '사당역',           37.476654, 126.982610,  80),
  ('bus_hub_sl_seoksu',   'bus_seoul', '석수역',           37.434876, 126.902779,  90),
  ('choji_station',       'seohae',    '초지역',           37.319819, 126.807750, 100),
  ('siheung_station',     'seohae',    '시흥시청역',       37.381656, 126.805878, 110),
  ('bus_hub_sl_guro',     'bus_seoul', '구로디지털단지역', 37.485300, 126.901000, 120);

-- ────────────────────────────────────────────────────────────
-- S15. 지도 마커 ↔ 노선 연결
-- ────────────────────────────────────────────────────────────
INSERT INTO map_marker_routes (marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, sort_order)
SELECT m.id, r.route_number, r.route_color, r.badge_text, r.out_sid, r.in_sid, r.sort_order
FROM map_markers m,
     (VALUES
       ('bus_hub_jw_sihwa',   '3400', '#DC2626', 'G',
        (SELECT id FROM bus_stops WHERE name='시화'),
        (SELECT id FROM bus_stops WHERE name='강남역'), 0),
       ('bus_hub_jw_emart',   '6502', '#DC2626', 'G',
        (SELECT id FROM bus_stops WHERE name='이마트'),
        (SELECT id FROM bus_stops WHERE name='사당역'), 0),
       ('bus_hub_jw_emart',   '3401', '#DC2626', 'G',
        (SELECT id FROM bus_stops WHERE name='이마트'),
        (SELECT id FROM bus_stops WHERE name='석수역'), 10),
       ('bus_hub_jw_emart',   '5602', '#DC2626', 'G',
        (SELECT id FROM bus_stops WHERE name='이마트'),
        (SELECT id FROM bus_stops WHERE name='구로디지털단지역'), 20),
       ('bus_hub_sl_gangnam', '3400', '#DC2626', 'G',
        (SELECT id FROM bus_stops WHERE name='강남역'),
        (SELECT id FROM bus_stops WHERE name='시화'), 0),
       ('bus_hub_sl_sadang',  '6502', '#DC2626', 'G',
        (SELECT id FROM bus_stops WHERE name='사당역'),
        (SELECT id FROM bus_stops WHERE name='이마트'), 0),
       ('bus_hub_sl_seoksu',  '3401', '#DC2626', 'G',
        (SELECT id FROM bus_stops WHERE name='석수역'),
        (SELECT id FROM bus_stops WHERE name='이마트'), 0),
       ('bus_hub_sl_guro',    '5602', '#DC2626', 'G',
        (SELECT id FROM bus_stops WHERE name='구로디지털단지역'),
        (SELECT id FROM bus_stops WHERE name='이마트'), 0),
       ('tec_bus_stop',       '11-A', '#0891B2', NULL, NULL, NULL, 10)
     ) AS r(marker_key, route_number, route_color, badge_text, out_sid, in_sid, sort_order)
WHERE m.marker_key = r.marker_key;

-- ────────────────────────────────────────────────────────────
-- S16. 앱 메타 정보 (id=1 고정)
-- ────────────────────────────────────────────────────────────
INSERT INTO app_info (id, version, description, feedback_url) VALUES
  (1, '1.0.0', '정왕 교통 허브 — 한국공학대학교·경기과학기술대학교 통합 교통 정보', NULL);


-- ============================================================
-- Alembic version stamping
-- schema.sql로 직접 생성 시 alembic이 중복 실행하지 않도록 head 고정
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
--    (postgres init-script → 스키마 + 시드 + alembic stamping)
-- 2. 지하철 시간표: POST /api/v1/admin/subway/refresh (lifespan에서 자동 실행)
-- ============================================================
