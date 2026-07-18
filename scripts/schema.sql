-- ============================================================
-- 정왕 교통 허브 — PostgreSQL 스키마 + 시드 데이터
-- 최종 수정: 2026-04-21 (prod-sync로 prod DB와 동기화)
-- 모델 기준: backend/app/models/ 전체 반영
-- 시드 출처: Railway prod DB data-only dump (volatile log 3테이블 제외)
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
DROP TABLE IF EXISTS push_subscriptions          CASCADE;
DROP TABLE IF EXISTS department_notices          CASCADE;
DROP TABLE IF EXISTS academic_calendar           CASCADE;


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
--    is_realtime: gbis_route_id IS NOT NULL 으로 모델 @property가 계산 (DB 컬럼 없음)
-- ────────────────────────────────────────────────────────────
CREATE TABLE bus_routes (
    id              SERIAL        PRIMARY KEY,
    route_number    VARCHAR(20)   NOT NULL,
    route_name      VARCHAR(100)
                    CHECK (route_name IS NULL OR length(route_name) > 0),
    direction_name  VARCHAR(50),
    gbis_route_id   VARCHAR(20),                   -- NULL이면 시간표 전용
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

-- 정류장 단위 도착 조회는 (stop_id, day_type, departure_time) 순으로 필터/정렬한다.
CREATE INDEX idx_bus_tt_stop_day
    ON bus_timetable_entries (stop_id, day_type, departure_time);

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

-- retention.py 나이틀리 정리(90일 보존)는 arrived_at 단독 조건(< now() - interval)
-- 으로 삭제 대상 5000행을 찾는다. 위 복합 인덱스는 arrived_at이 선두가 아니라
-- 이 조회에 못 쓰인다 → 단독 인덱스 추가.
CREATE INDEX idx_bus_arrival_arrived_at
    ON bus_arrival_history (arrived_at);

-- ────────────────────────────────────────────────────────────
-- 6. bus_arrival_stats — 분포 사전 집계 (p10/p50/p90/mean)
-- ────────────────────────────────────────────────────────────
-- bus_arrival_stats is derivative (recomputed nightly from bus_arrival_history).
-- ON DELETE CASCADE on both FKs intentional: if a route/stop is removed,
-- precomputed stats should be removed too — they'll be recreated on next refresh.
CREATE TABLE IF NOT EXISTS bus_arrival_stats (
    route_id          INTEGER      NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
    stop_id           INTEGER      NOT NULL REFERENCES bus_stops(id) ON DELETE CASCADE,
    day_type          VARCHAR(10)  NOT NULL CHECK (day_type IN ('weekday','saturday','sunday')),
    hour_of_day       SMALLINT     NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
    p10_interval_sec  INTEGER      NOT NULL CHECK (p10_interval_sec >= 0),
    p50_interval_sec  INTEGER      NOT NULL CHECK (p50_interval_sec >= 0),
    p90_interval_sec  INTEGER      NOT NULL CHECK (p90_interval_sec >= 0),
    mean_interval_sec INTEGER      NOT NULL CHECK (mean_interval_sec >= 0),
    sample_size       INTEGER      NOT NULL CHECK (sample_size > 0),
    computed_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (route_id, stop_id, day_type, hour_of_day)
);

-- ────────────────────────────────────────────────────────────
-- 7. bus_crowding_logs — 버스 혼잡도 이력
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

-- retention.py 나이틀리 정리(90일 보존)는 recorded_at 단독 조건으로 삭제 대상
-- 5000행을 찾는다. 위 복합 인덱스는 recorded_at이 선두가 아니라 이 조회에
-- 못 쓰인다 → 단독 인덱스 추가(traffic_history의 idx_traffic_collected_at과 동일 패턴).
CREATE INDEX idx_crowding_recorded_at
    ON bus_crowding_logs (recorded_at);

-- ────────────────────────────────────────────────────────────
-- 7b. bus_crowding_stats — 혼잡도 곡선 사전 집계 (30분 버킷 평균)
-- ────────────────────────────────────────────────────────────
-- bus_arrival_stats와 동일하게 derivative(매일 03:35 KST 나이틀리로
-- bus_crowding_logs에서 재계산)이며, ON DELETE CASCADE로 route/stop 삭제 시
-- 함께 정리된다(다음 refresh에서 재생성).
-- day_type은 다른 사전집계 테이블의 weekday/saturday/sunday 3분류와 달리
-- crowding_flow 도메인을 따라 weekday/weekend 2분류다.
-- bucket = hour*2 + half(0|1), 0~47 (30분 단위).
CREATE TABLE IF NOT EXISTS bus_crowding_stats (
    route_id     INTEGER      NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
    stop_id      INTEGER      NOT NULL REFERENCES bus_stops(id) ON DELETE CASCADE,
    day_type     VARCHAR(10)  NOT NULL CHECK (day_type IN ('weekday','weekend')),
    bucket       SMALLINT     NOT NULL CHECK (bucket BETWEEN 0 AND 47),
    avg_crowded  NUMERIC(4,2) NOT NULL CHECK (avg_crowded BETWEEN 1 AND 4),
    sample_size  INTEGER      NOT NULL CHECK (sample_size > 0),
    sample_days  INTEGER      NOT NULL CHECK (sample_days > 0),
    computed_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (route_id, stop_id, day_type, bucket)
);

-- ────────────────────────────────────────────────────────────
-- 8. schedule_periods — 셔틀 운행 기간
-- ────────────────────────────────────────────────────────────
CREATE TABLE schedule_periods (
    id              SERIAL       PRIMARY KEY,
    period_type     VARCHAR(20)  NOT NULL
                    CHECK (period_type IN ('SEMESTER','VACATION','EXAM','HOLIDAY','SUSPENDED','SEASONAL')),
    name            VARCHAR(100) NOT NULL,
    start_date      DATE         NOT NULL,
    end_date        DATE         NOT NULL CHECK (end_date >= start_date),
    priority        INTEGER      NOT NULL DEFAULT 0,
    notice_message  VARCHAR(500),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedule_periods_dates ON schedule_periods (start_date, end_date);

-- ────────────────────────────────────────────────────────────
-- 9. shuttle_routes — 셔틀 노선 (방면)
--    direction: 0=등교, 1=하교
-- ────────────────────────────────────────────────────────────
CREATE TABLE shuttle_routes (
    id           SERIAL    PRIMARY KEY,
    direction    SMALLINT  NOT NULL CHECK (direction IN (0, 1, 2, 3)),
    description  VARCHAR(255)
);

-- ────────────────────────────────────────────────────────────
-- 10. shuttle_timetable_entries — 셔틀 시간표
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
-- 11. subway_timetable_entries — 지하철 시간표 (admin API로 갱신)
-- ────────────────────────────────────────────────────────────
CREATE TABLE subway_timetable_entries (
    id              SERIAL      PRIMARY KEY,
    direction       VARCHAR(10) NOT NULL
                    CHECK (direction IN ('up', 'down', 'line4_up', 'line4_down', 'choji_up', 'choji_dn', 'siheung_up', 'siheung_dn')),
    day_type        VARCHAR(10) NOT NULL CHECK (day_type IN ('weekday', 'saturday', 'sunday')),
    departure_time  TIME        NOT NULL,
    destination     VARCHAR(50) NOT NULL,
    train_no        VARCHAR(20),  -- 서해선 K71xx=일산, K72xx=대곡 (tabriz.kr 시드)
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subway_tt_dir_day
    ON subway_timetable_entries (direction, day_type);

-- 시간표 조회는 day_type 필터 + departure_time 정렬이 주 패턴이다.
CREATE INDEX idx_subway_tt_day
    ON subway_timetable_entries (day_type, departure_time);

CREATE INDEX idx_subway_tt_train_no
    ON subway_timetable_entries (train_no);

-- ────────────────────────────────────────────────────────────
-- 12. traffic_history — 도로 교통정보 이력
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
-- 13. map_markers — 지도 마커 정의
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
-- 14. map_marker_routes — 마커 ↔ 노선 연결
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
-- 15. notices — 공지사항
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
-- 16. app_links — 앱 내 외부 링크
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
-- 17. app_info — 앱 메타 정보 (id=1 단일 행)
-- ────────────────────────────────────────────────────────────
CREATE TABLE app_info (
    id                        SERIAL       PRIMARY KEY,
    version                   VARCHAR(20)  NOT NULL,
    description               TEXT,
    feedback_url              VARCHAR(500),
    subway_last_refreshed_at  TIMESTAMPTZ,
    updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 18. push_subscriptions — Web Push 구독 (F5 노선 알림)
-- 사용자 계정이 없으므로 브라우저 PushManager가 발급하는 endpoint를 기본 키로 쓴다.
-- favorite_codes: 프론트 zustand favorites.routes와 동일한 favCode 문자열 배열
--   (예: "등교:5602", "shuttle:등교", "subway:정왕:up").
-- last_notified: 당일 중복 발송 방지. {"<favCode>:last": "YYYY-MM-DD",
--   "<favCode>:first": "YYYY-MM-DD"} 형태로 (favCode, edge)별 마지막 발송 날짜(KST) 기록.
-- ────────────────────────────────────────────────────────────
CREATE TABLE push_subscriptions (
    id              SERIAL       PRIMARY KEY,
    endpoint        TEXT         UNIQUE NOT NULL,
    p256dh_key      TEXT         NOT NULL,
    auth_key        TEXT         NOT NULL,
    favorite_codes  JSONB        NOT NULL DEFAULT '[]',
    last_notified   JSONB        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_push_subscriptions_updated_at
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 19. department_notices — 학과별 공지사항(RSS 수집)
-- 본문은 저장하지 않는다(제목+게시일+원문링크만) — 저작권 리스크 최소화 +
-- 원 사이트로 트래픽 유도. (department, external_id) UNIQUE로 재수집 시
-- 중복 삽입 방지. external_id는 원문 게시글 번호(RSS link의 숫자, 예: 151703).
-- ────────────────────────────────────────────────────────────
CREATE TABLE department_notices (
    id              SERIAL       PRIMARY KEY,
    department      VARCHAR(20)  NOT NULL,
    external_id     INTEGER      NOT NULL,
    title           VARCHAR(300) NOT NULL,
    url             VARCHAR(500) NOT NULL,
    published_at    TIMESTAMPTZ  NOT NULL,
    fetched_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (department, external_id)
);

CREATE INDEX idx_department_notices_dept_published
    ON department_notices (department, published_at DESC);

-- ────────────────────────────────────────────────────────────
-- 20. academic_calendar — 학사일정
-- 학교 사이트가 스크레이핑마다 현재 시점 기준 전체 목록을 권위 있는 스냅샷으로
-- 제공하므로 (title, start_date, end_date) UNIQUE + ON CONFLICT DO NOTHING으로
-- append-only 누적한다(삭제 로직 없음 — 그래스풀 디그레이데이션 유지).
-- ────────────────────────────────────────────────────────────
CREATE TABLE academic_calendar (
    id              SERIAL       PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    start_date      DATE         NOT NULL,
    end_date        DATE,
    fetched_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (title, start_date, end_date)
);

CREATE INDEX idx_academic_calendar_start_date
    ON academic_calendar (start_date);


-- ============================================================
-- SEED DATA — Railway prod DB에서 추출 (pg_dump --data-only --column-inserts)
-- volatile log 3테이블(traffic_history, bus_arrival_history, bus_crowding_logs)은
-- 데이터 제외, 시퀀스 setval만 포함.
-- ============================================================

-- Data for Name: app_info; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO app_info (id, version, description, feedback_url, updated_at) VALUES (1, 'test-0420', '탈(것)정왕 — 한국공학대학교·경기과학기술대학교 통합 교통 정보', NULL, '2026-04-20 07:51:53.174206+00');


--
-- Data for Name: app_links; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: bus_routes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (3, '20-1', '시흥20-1번', '아이파크아파트방면', '224000011', '하교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (2, '시흥33', '시흥33번', '시흥시청방면', '224000062', '하교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (1, '3400', NULL, '시화터미널 출발 사당 경유 강남행', NULL, '하교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (6, '6502', NULL, '사당행', NULL, '하교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (7, '3401', NULL, '시흥시청 경유 석수행', NULL, '하교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (8, '3400', NULL, '학교행', NULL, '등교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (9, '6502', NULL, '학교행', NULL, '등교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (11, '5602', '5602번', '구로디지털단지역방면', NULL, '하교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (4, '시흥1', '시흥1번', '신천역방면', '213000006', '하교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (13, '11-A', '시흥11-A번', '정왕역 방면', '224000036', '하교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (12, '5602', '5602번', '이마트(학교)', '216000047', '등교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (10, '3401', NULL, '이마트 방면', '224000071', '등교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (14, '시흥33', '시흥33번', '한국공학대학교 방면', '224000062', '등교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (15, '99-2', '시흥99-2번', '월곶역방면', '224000034', '하교');
INSERT INTO bus_routes (id, route_number, route_name, direction_name, gbis_route_id, category) VALUES (17, '5200', '시흥5200번', '신도림역방면', '224000052', '하교');


--
-- Data for Name: bus_stops; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (3, '한국공학대학교', '224000639', 37.339500, 126.733400, NULL);
INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (4, '정왕역', NULL, 37.351618, 126.742747, NULL);
INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (7, '석수역', NULL, 37.434876, 126.902779, NULL);
INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (5, '사당역', NULL, 37.476654, 126.982610, '14번 출구');
INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (6, '강남역', NULL, 37.498427, 127.029829, NULL);
INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (2, '이마트', '224000513', 37.340300, 126.728500, NULL);
INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (1, '시화', NULL, 37.314800, 126.806000, NULL);
INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (8, '구로디지털단지역', NULL, 37.485300, 126.901000, NULL);
INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (13, '시흥시청역', '224000586', 37.381656, 126.805878, '서해선 환승');
INSERT INTO bus_stops (id, name, gbis_station_id, lat, lng, sub_name) VALUES (17, '한국공학대학교 시흥터미널', '224000861', 37.342467, 126.735117, NULL);


--
-- Data for Name: bus_stop_routes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (17, 1);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (2, 4);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (3, 2);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (3, 3);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (2, 6);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (2, 7);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (6, 8);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (5, 9);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (7, 10);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (2, 11);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (8, 12);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (3, 13);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (13, 12);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (13, 10);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (13, 14);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (17, 15);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (2, 15);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (17, 17);
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id) VALUES (2, 17);


--
-- Data for Name: bus_timetable_entries; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (1, 1, 3, 'weekday', '05:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (2, 1, 3, 'weekday', '06:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (3, 1, 3, 'weekday', '06:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (4, 1, 3, 'weekday', '06:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (5, 1, 3, 'weekday', '06:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (6, 1, 3, 'weekday', '07:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (7, 1, 3, 'weekday', '07:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (8, 1, 3, 'weekday', '08:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (9, 1, 3, 'weekday', '08:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (10, 1, 3, 'weekday', '09:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (11, 1, 3, 'weekday', '09:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (12, 1, 3, 'weekday', '10:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (13, 1, 3, 'weekday', '10:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (14, 1, 3, 'weekday', '10:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (15, 1, 3, 'weekday', '11:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (16, 1, 3, 'weekday', '11:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (17, 1, 3, 'weekday', '12:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (18, 1, 3, 'weekday', '12:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (19, 1, 3, 'weekday', '12:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (20, 1, 3, 'weekday', '13:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (21, 1, 3, 'weekday', '13:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (22, 1, 3, 'weekday', '14:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (23, 1, 3, 'weekday', '14:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (24, 1, 3, 'weekday', '15:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (25, 1, 3, 'weekday', '15:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (26, 1, 3, 'weekday', '15:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (27, 1, 3, 'weekday', '16:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (28, 1, 3, 'weekday', '16:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (29, 1, 3, 'weekday', '17:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (30, 1, 3, 'weekday', '17:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (31, 1, 3, 'weekday', '18:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (32, 1, 3, 'weekday', '18:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (33, 1, 3, 'weekday', '19:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (34, 1, 3, 'weekday', '19:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (35, 1, 3, 'weekday', '20:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (36, 1, 3, 'weekday', '20:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (37, 1, 3, 'weekday', '20:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (38, 1, 3, 'weekday', '21:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (39, 1, 3, 'weekday', '21:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (40, 1, 3, 'weekday', '22:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (41, 1, 3, 'weekday', '22:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (42, 1, 3, 'weekday', '22:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (43, 1, 3, 'weekday', '23:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (44, 1, 3, 'saturday', '05:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (45, 1, 3, 'sunday', '05:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (46, 1, 3, 'saturday', '06:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (47, 1, 3, 'sunday', '06:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (48, 1, 3, 'saturday', '06:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (49, 1, 3, 'sunday', '06:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (50, 1, 3, 'saturday', '07:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (51, 1, 3, 'sunday', '07:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (52, 1, 3, 'saturday', '07:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (53, 1, 3, 'sunday', '07:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (54, 1, 3, 'saturday', '08:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (55, 1, 3, 'sunday', '08:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (56, 1, 3, 'saturday', '08:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (57, 1, 3, 'sunday', '08:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (58, 1, 3, 'saturday', '09:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (59, 1, 3, 'sunday', '09:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (60, 1, 3, 'saturday', '09:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (61, 1, 3, 'sunday', '09:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (62, 1, 3, 'saturday', '09:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (63, 1, 3, 'sunday', '09:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (64, 1, 3, 'saturday', '10:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (65, 1, 3, 'sunday', '10:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (66, 1, 3, 'saturday', '10:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (67, 1, 3, 'sunday', '10:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (68, 1, 3, 'saturday', '11:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (69, 1, 3, 'sunday', '11:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (70, 1, 3, 'saturday', '11:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (71, 1, 3, 'sunday', '11:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (72, 1, 3, 'saturday', '12:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (73, 1, 3, 'sunday', '12:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (74, 1, 3, 'saturday', '12:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (75, 1, 3, 'sunday', '12:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (76, 1, 3, 'saturday', '13:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (77, 1, 3, 'sunday', '13:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (78, 1, 3, 'saturday', '13:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (79, 1, 3, 'sunday', '13:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (80, 1, 3, 'saturday', '14:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (81, 1, 3, 'sunday', '14:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (82, 1, 3, 'saturday', '14:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (83, 1, 3, 'sunday', '14:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (84, 1, 3, 'saturday', '15:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (85, 1, 3, 'sunday', '15:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (86, 1, 3, 'saturday', '15:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (87, 1, 3, 'sunday', '15:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (88, 1, 3, 'saturday', '16:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (89, 1, 3, 'sunday', '16:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (90, 1, 3, 'saturday', '16:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (91, 1, 3, 'sunday', '16:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (92, 1, 3, 'saturday', '17:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (93, 1, 3, 'sunday', '17:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (94, 1, 3, 'saturday', '17:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (95, 1, 3, 'sunday', '17:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (96, 1, 3, 'saturday', '18:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (97, 1, 3, 'sunday', '18:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (98, 1, 3, 'saturday', '18:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (99, 1, 3, 'sunday', '18:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (100, 1, 3, 'saturday', '19:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (101, 1, 3, 'sunday', '19:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (102, 1, 3, 'saturday', '19:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (103, 1, 3, 'sunday', '19:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (104, 1, 3, 'saturday', '20:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (105, 1, 3, 'sunday', '20:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (106, 1, 3, 'saturday', '20:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (107, 1, 3, 'sunday', '20:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (108, 1, 3, 'saturday', '21:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (109, 1, 3, 'sunday', '21:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (110, 1, 3, 'saturday', '21:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (111, 1, 3, 'sunday', '21:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (112, 1, 3, 'saturday', '22:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (113, 1, 3, 'sunday', '22:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (114, 1, 3, 'saturday', '22:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (115, 1, 3, 'sunday', '22:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (116, 1, 3, 'saturday', '23:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (117, 1, 3, 'sunday', '23:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (118, 6, 2, 'weekday', '05:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (119, 6, 2, 'weekday', '05:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (120, 6, 2, 'weekday', '05:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (121, 6, 2, 'weekday', '06:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (122, 6, 2, 'weekday', '06:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (123, 6, 2, 'weekday', '06:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (124, 6, 2, 'weekday', '06:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (125, 6, 2, 'weekday', '07:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (126, 6, 2, 'weekday', '07:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (127, 6, 2, 'weekday', '07:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (128, 6, 2, 'weekday', '08:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (129, 6, 2, 'weekday', '08:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (130, 6, 2, 'weekday', '08:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (131, 6, 2, 'weekday', '09:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (132, 6, 2, 'weekday', '09:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (133, 6, 2, 'weekday', '10:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (134, 6, 2, 'weekday', '10:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (135, 6, 2, 'weekday', '11:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (136, 6, 2, 'weekday', '11:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (137, 6, 2, 'weekday', '12:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (138, 6, 2, 'weekday', '12:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (139, 6, 2, 'weekday', '13:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (140, 6, 2, 'weekday', '13:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (141, 6, 2, 'weekday', '14:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (142, 6, 2, 'weekday', '15:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (143, 6, 2, 'weekday', '15:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (144, 6, 2, 'weekday', '16:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (145, 6, 2, 'weekday', '16:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (146, 6, 2, 'weekday', '16:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (147, 6, 2, 'weekday', '17:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (148, 6, 2, 'weekday', '17:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (149, 6, 2, 'weekday', '18:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (150, 6, 2, 'weekday', '18:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (151, 6, 2, 'weekday', '19:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (152, 6, 2, 'weekday', '19:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (153, 6, 2, 'weekday', '20:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (154, 6, 2, 'weekday', '20:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (155, 6, 2, 'weekday', '21:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (156, 6, 2, 'weekday', '21:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (157, 6, 2, 'weekday', '22:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (158, 6, 2, 'weekday', '22:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (159, 6, 2, 'saturday', '05:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (160, 6, 2, 'sunday', '05:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (161, 6, 2, 'saturday', '06:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (162, 6, 2, 'sunday', '06:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (163, 6, 2, 'saturday', '06:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (164, 6, 2, 'sunday', '06:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (165, 6, 2, 'saturday', '07:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (166, 6, 2, 'sunday', '07:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (167, 6, 2, 'saturday', '08:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (168, 6, 2, 'sunday', '08:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (169, 6, 2, 'saturday', '08:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (170, 6, 2, 'sunday', '08:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (171, 6, 2, 'saturday', '09:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (172, 6, 2, 'sunday', '09:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (173, 6, 2, 'saturday', '10:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (174, 6, 2, 'sunday', '10:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (175, 6, 2, 'saturday', '10:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (176, 6, 2, 'sunday', '10:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (177, 6, 2, 'saturday', '11:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (178, 6, 2, 'sunday', '11:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (179, 6, 2, 'saturday', '11:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (180, 6, 2, 'sunday', '11:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (181, 6, 2, 'saturday', '12:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (182, 6, 2, 'sunday', '12:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (183, 6, 2, 'saturday', '13:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (184, 6, 2, 'sunday', '13:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (185, 6, 2, 'saturday', '13:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (186, 6, 2, 'sunday', '13:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (187, 6, 2, 'saturday', '14:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (188, 6, 2, 'sunday', '14:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (189, 6, 2, 'saturday', '15:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (190, 6, 2, 'sunday', '15:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (191, 6, 2, 'saturday', '15:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (192, 6, 2, 'sunday', '15:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (193, 6, 2, 'saturday', '16:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (194, 6, 2, 'sunday', '16:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (195, 6, 2, 'saturday', '17:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (196, 6, 2, 'sunday', '17:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (197, 6, 2, 'saturday', '17:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (198, 6, 2, 'sunday', '17:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (199, 6, 2, 'saturday', '18:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (200, 6, 2, 'sunday', '18:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (201, 6, 2, 'saturday', '19:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (202, 6, 2, 'sunday', '19:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (203, 6, 2, 'saturday', '19:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (204, 6, 2, 'sunday', '19:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (205, 6, 2, 'saturday', '20:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (206, 6, 2, 'sunday', '20:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (207, 6, 2, 'saturday', '21:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (208, 6, 2, 'sunday', '21:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (209, 6, 2, 'saturday', '21:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (210, 6, 2, 'sunday', '21:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (211, 6, 2, 'saturday', '22:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (212, 6, 2, 'sunday', '22:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (213, 6, 2, 'saturday', '22:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (214, 6, 2, 'sunday', '22:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (508, 11, 2, 'weekday', '05:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (509, 11, 2, 'weekday', '05:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (510, 11, 2, 'weekday', '06:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (511, 11, 2, 'weekday', '06:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (512, 11, 2, 'weekday', '06:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (513, 11, 2, 'weekday', '06:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (514, 11, 2, 'weekday', '07:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (515, 11, 2, 'weekday', '07:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (516, 11, 2, 'weekday', '07:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (517, 11, 2, 'weekday', '08:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (518, 11, 2, 'weekday', '08:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (519, 11, 2, 'weekday', '08:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (520, 11, 2, 'weekday', '09:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (521, 11, 2, 'weekday', '09:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (522, 11, 2, 'weekday', '09:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (523, 11, 2, 'weekday', '10:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (524, 11, 2, 'weekday', '10:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (525, 11, 2, 'weekday', '10:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (526, 11, 2, 'weekday', '11:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (527, 11, 2, 'weekday', '11:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (528, 11, 2, 'weekday', '11:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (529, 11, 2, 'weekday', '12:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (530, 11, 2, 'weekday', '12:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (531, 11, 2, 'weekday', '12:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (532, 11, 2, 'weekday', '13:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (533, 11, 2, 'weekday', '13:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (534, 11, 2, 'weekday', '13:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (535, 11, 2, 'weekday', '14:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (536, 11, 2, 'weekday', '14:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (537, 11, 2, 'weekday', '14:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (538, 11, 2, 'weekday', '15:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (539, 11, 2, 'weekday', '15:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (540, 11, 2, 'weekday', '15:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (541, 11, 2, 'weekday', '16:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (542, 11, 2, 'weekday', '16:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (543, 11, 2, 'weekday', '16:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (544, 11, 2, 'weekday', '17:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (545, 11, 2, 'weekday', '17:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (546, 11, 2, 'weekday', '17:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (547, 11, 2, 'weekday', '18:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (548, 11, 2, 'weekday', '18:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (549, 11, 2, 'weekday', '18:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (550, 11, 2, 'weekday', '18:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (551, 11, 2, 'weekday', '19:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (552, 11, 2, 'weekday', '19:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (553, 11, 2, 'weekday', '19:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (554, 11, 2, 'weekday', '20:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (555, 11, 2, 'weekday', '20:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (556, 11, 2, 'weekday', '21:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (557, 11, 2, 'weekday', '21:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (558, 11, 2, 'weekday', '22:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (559, 11, 2, 'weekday', '22:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (560, 11, 2, 'saturday', '05:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (561, 11, 2, 'sunday', '05:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (215, 8, 6, 'weekday', '07:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (216, 8, 6, 'weekday', '07:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (217, 8, 6, 'weekday', '07:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (562, 11, 2, 'saturday', '05:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (563, 11, 2, 'sunday', '05:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (564, 11, 2, 'saturday', '06:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (565, 11, 2, 'sunday', '06:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (566, 11, 2, 'saturday', '06:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (567, 11, 2, 'sunday', '06:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (568, 11, 2, 'saturday', '07:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (569, 11, 2, 'sunday', '07:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (570, 11, 2, 'saturday', '07:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (571, 11, 2, 'sunday', '07:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (572, 11, 2, 'saturday', '08:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (573, 11, 2, 'sunday', '08:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (574, 11, 2, 'saturday', '08:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (575, 11, 2, 'sunday', '08:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (576, 11, 2, 'saturday', '08:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (577, 11, 2, 'sunday', '08:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (578, 11, 2, 'saturday', '09:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (579, 11, 2, 'sunday', '09:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (580, 11, 2, 'saturday', '09:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (581, 11, 2, 'sunday', '09:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (582, 11, 2, 'saturday', '10:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (583, 11, 2, 'sunday', '10:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (584, 11, 2, 'saturday', '10:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (585, 11, 2, 'sunday', '10:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (586, 11, 2, 'saturday', '10:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (587, 11, 2, 'sunday', '10:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (588, 11, 2, 'saturday', '11:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (589, 11, 2, 'sunday', '11:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (590, 11, 2, 'saturday', '11:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (591, 11, 2, 'sunday', '11:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (592, 11, 2, 'saturday', '12:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (593, 11, 2, 'sunday', '12:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (594, 11, 2, 'saturday', '12:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (595, 11, 2, 'sunday', '12:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (596, 11, 2, 'saturday', '13:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (597, 11, 2, 'sunday', '13:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (598, 11, 2, 'saturday', '13:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (599, 11, 2, 'sunday', '13:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (600, 11, 2, 'saturday', '14:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (601, 11, 2, 'sunday', '14:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (602, 11, 2, 'saturday', '14:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (603, 11, 2, 'sunday', '14:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (604, 11, 2, 'saturday', '15:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (605, 11, 2, 'sunday', '15:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (606, 11, 2, 'saturday', '15:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (607, 11, 2, 'sunday', '15:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (608, 11, 2, 'saturday', '16:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (609, 11, 2, 'sunday', '16:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (610, 11, 2, 'saturday', '16:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (611, 11, 2, 'sunday', '16:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (612, 11, 2, 'saturday', '17:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (613, 11, 2, 'sunday', '17:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (614, 11, 2, 'saturday', '17:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (615, 11, 2, 'sunday', '17:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (616, 11, 2, 'saturday', '18:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (617, 11, 2, 'sunday', '18:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (618, 11, 2, 'saturday', '18:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (619, 11, 2, 'sunday', '18:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (620, 11, 2, 'saturday', '19:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (621, 11, 2, 'sunday', '19:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (622, 11, 2, 'saturday', '19:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (623, 11, 2, 'sunday', '19:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (624, 11, 2, 'saturday', '20:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (625, 11, 2, 'sunday', '20:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (626, 11, 2, 'saturday', '20:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (627, 11, 2, 'sunday', '20:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (628, 11, 2, 'saturday', '21:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (629, 11, 2, 'sunday', '21:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (630, 11, 2, 'saturday', '21:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (631, 11, 2, 'sunday', '21:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (632, 11, 2, 'saturday', '22:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (633, 11, 2, 'sunday', '22:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (634, 11, 2, 'saturday', '22:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (635, 11, 2, 'sunday', '22:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (636, 12, 8, 'weekday', '07:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (637, 12, 8, 'weekday', '07:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (638, 12, 8, 'weekday', '07:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (639, 12, 8, 'weekday', '08:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (640, 12, 8, 'weekday', '08:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (641, 12, 8, 'weekday', '08:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (642, 12, 8, 'weekday', '08:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (643, 12, 8, 'weekday', '09:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (644, 12, 8, 'weekday', '09:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (355, 7, 2, 'weekday', '05:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (356, 7, 2, 'weekday', '06:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (357, 7, 2, 'weekday', '06:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (358, 7, 2, 'weekday', '07:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (359, 7, 2, 'weekday', '07:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (360, 7, 2, 'weekday', '07:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (361, 7, 2, 'weekday', '08:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (362, 7, 2, 'weekday', '09:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (363, 7, 2, 'weekday', '09:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (364, 7, 2, 'weekday', '10:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (365, 7, 2, 'weekday', '10:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (366, 7, 2, 'weekday', '11:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (367, 7, 2, 'weekday', '12:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (368, 7, 2, 'weekday', '12:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (369, 7, 2, 'weekday', '13:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (370, 7, 2, 'weekday', '13:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (371, 7, 2, 'weekday', '14:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (372, 7, 2, 'weekday', '15:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (373, 7, 2, 'weekday', '15:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (374, 7, 2, 'weekday', '16:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (375, 7, 2, 'weekday', '17:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (376, 7, 2, 'weekday', '17:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (377, 7, 2, 'weekday', '17:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (378, 7, 2, 'weekday', '18:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (379, 7, 2, 'weekday', '19:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (380, 7, 2, 'weekday', '19:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (381, 7, 2, 'weekday', '20:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (382, 7, 2, 'weekday', '20:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (383, 7, 2, 'weekday', '21:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (384, 7, 2, 'weekday', '22:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (385, 7, 2, 'saturday', '05:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (386, 7, 2, 'saturday', '06:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (387, 7, 2, 'saturday', '06:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (388, 7, 2, 'saturday', '07:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (389, 7, 2, 'saturday', '08:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (390, 7, 2, 'saturday', '08:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (391, 7, 2, 'saturday', '09:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (392, 7, 2, 'saturday', '10:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (393, 7, 2, 'saturday', '10:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (394, 7, 2, 'saturday', '11:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (395, 7, 2, 'saturday', '12:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (396, 7, 2, 'saturday', '12:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (397, 7, 2, 'saturday', '13:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (398, 7, 2, 'saturday', '14:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (399, 7, 2, 'saturday', '14:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (400, 7, 2, 'saturday', '15:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (401, 7, 2, 'saturday', '16:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (402, 7, 2, 'saturday', '17:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (403, 7, 2, 'saturday', '18:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (404, 7, 2, 'saturday', '19:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (405, 7, 2, 'saturday', '19:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (406, 7, 2, 'saturday', '20:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (407, 7, 2, 'saturday', '21:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (408, 7, 2, 'sunday', '05:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (409, 7, 2, 'sunday', '06:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (410, 7, 2, 'sunday', '06:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (411, 7, 2, 'sunday', '07:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (412, 7, 2, 'sunday', '08:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (413, 7, 2, 'sunday', '08:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (414, 7, 2, 'sunday', '09:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (415, 7, 2, 'sunday', '10:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (416, 7, 2, 'sunday', '10:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (417, 7, 2, 'sunday', '11:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (418, 7, 2, 'sunday', '12:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (419, 7, 2, 'sunday', '12:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (420, 7, 2, 'sunday', '13:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (421, 7, 2, 'sunday', '14:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (422, 7, 2, 'sunday', '14:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (423, 7, 2, 'sunday', '15:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (424, 7, 2, 'sunday', '16:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (425, 7, 2, 'sunday', '17:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (426, 7, 2, 'sunday', '18:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (427, 7, 2, 'sunday', '19:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (428, 7, 2, 'sunday', '19:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (429, 7, 2, 'sunday', '20:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (430, 7, 2, 'sunday', '21:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (645, 12, 8, 'weekday', '09:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (646, 12, 8, 'weekday', '10:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (647, 12, 8, 'weekday', '10:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (648, 12, 8, 'weekday', '10:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (649, 12, 8, 'weekday', '11:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (650, 12, 8, 'weekday', '11:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (651, 12, 8, 'weekday', '11:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (652, 12, 8, 'weekday', '12:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (653, 12, 8, 'weekday', '12:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (654, 12, 8, 'weekday', '12:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (655, 12, 8, 'weekday', '13:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (656, 12, 8, 'weekday', '13:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (657, 12, 8, 'weekday', '13:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (658, 12, 8, 'weekday', '14:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (659, 12, 8, 'weekday', '14:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (660, 12, 8, 'weekday', '14:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (661, 12, 8, 'weekday', '15:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (662, 12, 8, 'weekday', '15:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (663, 12, 8, 'weekday', '15:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (664, 12, 8, 'weekday', '16:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (665, 12, 8, 'weekday', '16:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (666, 12, 8, 'weekday', '16:42:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (667, 12, 8, 'weekday', '17:04:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (668, 12, 8, 'weekday', '17:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (669, 12, 8, 'weekday', '17:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (670, 12, 8, 'weekday', '18:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (671, 12, 8, 'weekday', '18:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (672, 12, 8, 'weekday', '18:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (673, 12, 8, 'weekday', '19:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (674, 12, 8, 'weekday', '19:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (675, 12, 8, 'weekday', '19:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (676, 12, 8, 'weekday', '20:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (677, 12, 8, 'weekday', '20:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (678, 12, 8, 'weekday', '20:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (679, 12, 8, 'weekday', '20:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (680, 12, 8, 'weekday', '21:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (681, 12, 8, 'weekday', '21:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (682, 12, 8, 'weekday', '21:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (683, 12, 8, 'weekday', '22:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (684, 12, 8, 'weekday', '22:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (685, 12, 8, 'weekday', '23:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (686, 12, 8, 'weekday', '23:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (687, 12, 8, 'weekday', '00:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (688, 12, 8, 'saturday', '07:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (689, 12, 8, 'sunday', '07:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (690, 12, 8, 'saturday', '07:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (691, 12, 8, 'sunday', '07:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (692, 12, 8, 'saturday', '07:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (693, 12, 8, 'sunday', '07:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (694, 12, 8, 'saturday', '08:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (695, 12, 8, 'sunday', '08:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (696, 12, 8, 'saturday', '08:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (697, 12, 8, 'sunday', '08:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (698, 12, 8, 'saturday', '09:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (699, 12, 8, 'sunday', '09:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (700, 12, 8, 'saturday', '09:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (701, 12, 8, 'sunday', '09:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (702, 12, 8, 'saturday', '10:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (703, 12, 8, 'sunday', '10:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (704, 12, 8, 'saturday', '10:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (705, 12, 8, 'sunday', '10:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (706, 12, 8, 'saturday', '10:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (707, 12, 8, 'sunday', '10:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (708, 12, 8, 'saturday', '11:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (709, 12, 8, 'sunday', '11:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (710, 12, 8, 'saturday', '11:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (711, 12, 8, 'sunday', '11:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (712, 12, 8, 'saturday', '12:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (713, 12, 8, 'sunday', '12:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (714, 12, 8, 'saturday', '12:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (715, 12, 8, 'sunday', '12:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (716, 12, 8, 'saturday', '13:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (717, 12, 8, 'sunday', '13:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (718, 12, 8, 'saturday', '13:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (719, 12, 8, 'sunday', '13:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (720, 12, 8, 'saturday', '13:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (721, 12, 8, 'sunday', '13:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (218, 8, 6, 'weekday', '08:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (219, 8, 6, 'weekday', '08:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (220, 8, 6, 'weekday', '08:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (221, 8, 6, 'weekday', '09:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (222, 8, 6, 'weekday', '09:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (223, 8, 6, 'weekday', '10:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (224, 8, 6, 'weekday', '10:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (225, 8, 6, 'weekday', '11:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (226, 8, 6, 'weekday', '11:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (227, 8, 6, 'weekday', '11:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (228, 8, 6, 'weekday', '12:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (229, 8, 6, 'weekday', '12:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (230, 8, 6, 'weekday', '13:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (231, 8, 6, 'weekday', '13:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (232, 8, 6, 'weekday', '14:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (233, 8, 6, 'weekday', '14:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (234, 8, 6, 'weekday', '14:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (235, 8, 6, 'weekday', '15:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (236, 8, 6, 'weekday', '15:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (237, 8, 6, 'weekday', '16:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (238, 8, 6, 'weekday', '16:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (239, 8, 6, 'weekday', '17:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (240, 8, 6, 'weekday', '17:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (241, 8, 6, 'weekday', '17:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (242, 8, 6, 'weekday', '18:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (243, 8, 6, 'weekday', '18:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (244, 8, 6, 'weekday', '19:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (245, 8, 6, 'weekday', '19:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (246, 8, 6, 'weekday', '20:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (247, 8, 6, 'weekday', '20:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (248, 8, 6, 'weekday', '21:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (249, 8, 6, 'weekday', '21:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (250, 8, 6, 'weekday', '21:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (251, 8, 6, 'weekday', '22:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (252, 8, 6, 'weekday', '22:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (253, 8, 6, 'weekday', '23:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (254, 8, 6, 'weekday', '23:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (255, 8, 6, 'weekday', '23:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (256, 8, 6, 'weekday', '00:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (257, 8, 6, 'weekday', '00:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (938, 8, 6, 'saturday', '00:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (939, 8, 6, 'saturday', '00:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (940, 8, 6, 'saturday', '06:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (941, 8, 6, 'saturday', '07:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (942, 8, 6, 'saturday', '08:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (943, 8, 6, 'saturday', '08:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (944, 8, 6, 'saturday', '09:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (945, 8, 6, 'saturday', '09:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (946, 8, 6, 'saturday', '10:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (947, 8, 6, 'saturday', '10:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (948, 8, 6, 'saturday', '11:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (949, 8, 6, 'saturday', '11:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (950, 8, 6, 'saturday', '12:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (951, 8, 6, 'saturday', '12:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (952, 8, 6, 'saturday', '13:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (953, 8, 6, 'saturday', '13:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (954, 8, 6, 'saturday', '14:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (955, 8, 6, 'saturday', '15:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (956, 8, 6, 'saturday', '15:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (957, 8, 6, 'saturday', '16:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (958, 8, 6, 'saturday', '17:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (959, 8, 6, 'saturday', '17:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (960, 8, 6, 'saturday', '18:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (961, 8, 6, 'saturday', '18:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (962, 8, 6, 'saturday', '19:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (963, 8, 6, 'saturday', '19:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (964, 8, 6, 'saturday', '20:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (965, 8, 6, 'saturday', '20:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (966, 8, 6, 'saturday', '21:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (967, 8, 6, 'saturday', '21:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (968, 8, 6, 'saturday', '22:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (969, 8, 6, 'saturday', '22:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (970, 8, 6, 'saturday', '23:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (971, 8, 6, 'saturday', '23:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (972, 8, 6, 'sunday', '00:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (973, 8, 6, 'sunday', '00:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (974, 8, 6, 'sunday', '06:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (975, 8, 6, 'sunday', '07:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (976, 8, 6, 'sunday', '08:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (977, 8, 6, 'sunday', '08:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (978, 8, 6, 'sunday', '09:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (979, 8, 6, 'sunday', '09:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (980, 8, 6, 'sunday', '10:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (981, 8, 6, 'sunday', '10:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (982, 8, 6, 'sunday', '11:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (983, 8, 6, 'sunday', '11:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (984, 8, 6, 'sunday', '12:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (985, 8, 6, 'sunday', '12:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (986, 8, 6, 'sunday', '13:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (987, 8, 6, 'sunday', '13:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (988, 8, 6, 'sunday', '14:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (989, 8, 6, 'sunday', '15:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (990, 8, 6, 'sunday', '15:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (991, 8, 6, 'sunday', '16:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (992, 8, 6, 'sunday', '17:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (993, 8, 6, 'sunday', '17:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (994, 8, 6, 'sunday', '18:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (995, 8, 6, 'sunday', '18:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (996, 8, 6, 'sunday', '19:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (997, 8, 6, 'sunday', '19:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (998, 8, 6, 'sunday', '20:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (999, 8, 6, 'sunday', '20:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (1000, 8, 6, 'sunday', '21:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (1001, 8, 6, 'sunday', '21:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (1002, 8, 6, 'sunday', '22:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (1003, 8, 6, 'sunday', '22:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (1004, 8, 6, 'sunday', '23:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (1005, 8, 6, 'sunday', '23:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (260, 9, 5, 'weekday', '06:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (261, 9, 5, 'weekday', '06:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (262, 9, 5, 'weekday', '06:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (263, 9, 5, 'weekday', '07:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (264, 9, 5, 'weekday', '07:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (265, 9, 5, 'weekday', '07:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (266, 9, 5, 'weekday', '08:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (267, 9, 5, 'weekday', '08:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (268, 9, 5, 'weekday', '09:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (269, 9, 5, 'weekday', '09:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (270, 9, 5, 'weekday', '09:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (271, 9, 5, 'weekday', '10:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (272, 9, 5, 'weekday', '10:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (273, 9, 5, 'weekday', '11:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (274, 9, 5, 'weekday', '11:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (275, 9, 5, 'weekday', '12:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (276, 9, 5, 'weekday', '12:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (277, 9, 5, 'weekday', '13:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (278, 9, 5, 'weekday', '13:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (279, 9, 5, 'weekday', '14:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (280, 9, 5, 'weekday', '14:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (281, 9, 5, 'weekday', '15:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (282, 9, 5, 'weekday', '16:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (283, 9, 5, 'weekday', '16:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (284, 9, 5, 'weekday', '17:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (285, 9, 5, 'weekday', '17:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (286, 9, 5, 'weekday', '18:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (287, 9, 5, 'weekday', '18:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (288, 9, 5, 'weekday', '18:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (289, 9, 5, 'weekday', '19:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (290, 9, 5, 'weekday', '19:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (291, 9, 5, 'weekday', '20:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (292, 9, 5, 'weekday', '20:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (293, 9, 5, 'weekday', '20:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (294, 9, 5, 'weekday', '21:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (295, 9, 5, 'weekday', '21:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (296, 9, 5, 'weekday', '22:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (297, 9, 5, 'weekday', '22:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (298, 9, 5, 'weekday', '23:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (299, 9, 5, 'saturday', '06:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (300, 9, 5, 'sunday', '06:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (301, 9, 5, 'saturday', '07:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (302, 9, 5, 'sunday', '07:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (303, 9, 5, 'saturday', '07:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (304, 9, 5, 'sunday', '07:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (305, 9, 5, 'saturday', '08:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (306, 9, 5, 'sunday', '08:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (307, 9, 5, 'saturday', '09:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (308, 9, 5, 'sunday', '09:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (309, 9, 5, 'saturday', '09:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (310, 9, 5, 'sunday', '09:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (311, 9, 5, 'saturday', '10:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (312, 9, 5, 'sunday', '10:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (313, 9, 5, 'saturday', '11:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (314, 9, 5, 'sunday', '11:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (315, 9, 5, 'saturday', '11:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (316, 9, 5, 'sunday', '11:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (317, 9, 5, 'saturday', '12:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (318, 9, 5, 'sunday', '12:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (319, 9, 5, 'saturday', '12:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (320, 9, 5, 'sunday', '12:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (321, 9, 5, 'saturday', '13:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (322, 9, 5, 'sunday', '13:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (323, 9, 5, 'saturday', '14:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (324, 9, 5, 'sunday', '14:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (325, 9, 5, 'saturday', '14:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (326, 9, 5, 'sunday', '14:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (327, 9, 5, 'saturday', '15:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (328, 9, 5, 'sunday', '15:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (329, 9, 5, 'saturday', '16:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (330, 9, 5, 'sunday', '16:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (331, 9, 5, 'saturday', '16:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (332, 9, 5, 'sunday', '16:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (333, 9, 5, 'saturday', '17:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (334, 9, 5, 'sunday', '17:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (335, 9, 5, 'saturday', '18:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (336, 9, 5, 'sunday', '18:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (337, 9, 5, 'saturday', '18:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (338, 9, 5, 'sunday', '18:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (339, 9, 5, 'saturday', '19:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (340, 9, 5, 'sunday', '19:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (341, 9, 5, 'saturday', '19:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (342, 9, 5, 'sunday', '19:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (343, 9, 5, 'saturday', '20:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (344, 9, 5, 'sunday', '20:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (345, 9, 5, 'saturday', '21:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (346, 9, 5, 'sunday', '21:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (347, 9, 5, 'saturday', '21:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (348, 9, 5, 'sunday', '21:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (349, 9, 5, 'saturday', '22:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (350, 9, 5, 'sunday', '22:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (351, 9, 5, 'saturday', '23:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (352, 9, 5, 'sunday', '23:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (353, 9, 5, 'saturday', '23:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (354, 9, 5, 'sunday', '23:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (431, 10, 7, 'weekday', '06:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (432, 10, 7, 'weekday', '07:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (433, 10, 7, 'weekday', '07:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (434, 10, 7, 'weekday', '08:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (435, 10, 7, 'weekday', '08:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (436, 10, 7, 'weekday', '09:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (437, 10, 7, 'weekday', '09:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (438, 10, 7, 'weekday', '10:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (439, 10, 7, 'weekday', '10:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (440, 10, 7, 'weekday', '11:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (441, 10, 7, 'weekday', '11:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (442, 10, 7, 'weekday', '12:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (443, 10, 7, 'weekday', '13:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (444, 10, 7, 'weekday', '13:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (445, 10, 7, 'weekday', '14:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (446, 10, 7, 'weekday', '14:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (447, 10, 7, 'weekday', '15:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (448, 10, 7, 'weekday', '16:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (449, 10, 7, 'weekday', '16:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (450, 10, 7, 'weekday', '17:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (451, 10, 7, 'weekday', '17:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (452, 10, 7, 'weekday', '18:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (453, 10, 7, 'weekday', '18:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (454, 10, 7, 'weekday', '18:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (455, 10, 7, 'weekday', '19:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (456, 10, 7, 'weekday', '20:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (457, 10, 7, 'weekday', '20:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (458, 10, 7, 'weekday', '21:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (459, 10, 7, 'weekday', '21:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (460, 10, 7, 'weekday', '22:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (461, 10, 7, 'weekday', '23:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (462, 10, 7, 'saturday', '06:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (463, 10, 7, 'saturday', '07:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (464, 10, 7, 'saturday', '07:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (465, 10, 7, 'saturday', '08:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (466, 10, 7, 'saturday', '09:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (467, 10, 7, 'saturday', '09:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (468, 10, 7, 'saturday', '10:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (469, 10, 7, 'saturday', '11:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (470, 10, 7, 'saturday', '11:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (471, 10, 7, 'saturday', '12:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (472, 10, 7, 'saturday', '13:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (473, 10, 7, 'saturday', '13:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (474, 10, 7, 'saturday', '14:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (475, 10, 7, 'saturday', '15:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (476, 10, 7, 'saturday', '15:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (477, 10, 7, 'saturday', '16:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (478, 10, 7, 'saturday', '17:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (479, 10, 7, 'saturday', '18:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (480, 10, 7, 'saturday', '19:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (481, 10, 7, 'saturday', '20:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (482, 10, 7, 'saturday', '20:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (483, 10, 7, 'saturday', '21:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (484, 10, 7, 'saturday', '22:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (485, 10, 7, 'sunday', '06:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (486, 10, 7, 'sunday', '07:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (487, 10, 7, 'sunday', '07:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (488, 10, 7, 'sunday', '08:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (489, 10, 7, 'sunday', '09:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (490, 10, 7, 'sunday', '09:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (491, 10, 7, 'sunday', '10:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (492, 10, 7, 'sunday', '11:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (493, 10, 7, 'sunday', '11:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (494, 10, 7, 'sunday', '12:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (495, 10, 7, 'sunday', '13:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (496, 10, 7, 'sunday', '13:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (497, 10, 7, 'sunday', '14:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (498, 10, 7, 'sunday', '15:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (499, 10, 7, 'sunday', '15:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (500, 10, 7, 'sunday', '16:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (501, 10, 7, 'sunday', '17:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (502, 10, 7, 'sunday', '18:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (503, 10, 7, 'sunday', '19:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (504, 10, 7, 'sunday', '20:05:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (505, 10, 7, 'sunday', '20:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (506, 10, 7, 'sunday', '21:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (507, 10, 7, 'sunday', '22:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (722, 12, 8, 'saturday', '14:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (723, 12, 8, 'sunday', '14:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (724, 12, 8, 'saturday', '14:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (725, 12, 8, 'sunday', '14:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (726, 12, 8, 'saturday', '15:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (727, 12, 8, 'sunday', '15:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (728, 12, 8, 'saturday', '15:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (729, 12, 8, 'sunday', '15:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (730, 12, 8, 'saturday', '16:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (731, 12, 8, 'sunday', '16:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (732, 12, 8, 'saturday', '16:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (733, 12, 8, 'sunday', '16:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (734, 12, 8, 'saturday', '17:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (735, 12, 8, 'sunday', '17:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (736, 12, 8, 'saturday', '17:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (737, 12, 8, 'sunday', '17:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (738, 12, 8, 'saturday', '18:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (739, 12, 8, 'sunday', '18:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (740, 12, 8, 'saturday', '18:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (741, 12, 8, 'sunday', '18:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (742, 12, 8, 'saturday', '19:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (743, 12, 8, 'sunday', '19:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (744, 12, 8, 'saturday', '19:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (745, 12, 8, 'sunday', '19:55:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (746, 12, 8, 'saturday', '20:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (747, 12, 8, 'sunday', '20:25:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (748, 12, 8, 'saturday', '20:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (749, 12, 8, 'sunday', '20:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (750, 12, 8, 'saturday', '21:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (751, 12, 8, 'sunday', '21:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (752, 12, 8, 'saturday', '21:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (753, 12, 8, 'sunday', '21:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (754, 12, 8, 'saturday', '22:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (755, 12, 8, 'sunday', '22:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (756, 12, 8, 'saturday', '22:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (757, 12, 8, 'sunday', '22:45:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (758, 12, 8, 'saturday', '23:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (759, 12, 8, 'sunday', '23:15:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (760, 12, 8, 'saturday', '23:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (761, 12, 8, 'sunday', '23:35:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (762, 12, 8, 'saturday', '00:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (763, 12, 8, 'sunday', '00:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (764, 2, 3, 'weekday', '06:12:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (765, 2, 3, 'weekday', '06:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (766, 2, 3, 'weekday', '06:46:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (767, 2, 3, 'weekday', '07:02:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (768, 2, 3, 'weekday', '07:18:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (769, 2, 3, 'weekday', '07:26:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (770, 2, 3, 'weekday', '07:42:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (771, 2, 3, 'weekday', '07:48:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (772, 2, 3, 'weekday', '08:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (773, 2, 3, 'weekday', '08:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (774, 2, 3, 'weekday', '08:38:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (775, 2, 3, 'weekday', '08:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (776, 2, 3, 'weekday', '09:02:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (777, 2, 3, 'weekday', '09:14:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (778, 2, 3, 'weekday', '09:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (779, 2, 3, 'weekday', '09:42:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (780, 2, 3, 'weekday', '09:54:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (781, 2, 3, 'weekday', '10:12:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (782, 2, 3, 'weekday', '10:26:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (783, 2, 3, 'weekday', '10:36:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (784, 2, 3, 'weekday', '10:56:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (785, 2, 3, 'weekday', '11:12:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (786, 2, 3, 'weekday', '11:24:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (787, 2, 3, 'weekday', '11:42:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (788, 2, 3, 'weekday', '11:54:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (789, 2, 3, 'weekday', '12:08:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (790, 2, 3, 'weekday', '12:26:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (791, 2, 3, 'weekday', '12:54:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (792, 2, 3, 'weekday', '13:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (793, 2, 3, 'weekday', '13:24:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (794, 2, 3, 'weekday', '13:42:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (795, 2, 3, 'weekday', '13:58:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (796, 2, 3, 'weekday', '14:12:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (797, 2, 3, 'weekday', '14:24:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (798, 2, 3, 'weekday', '14:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (799, 2, 3, 'weekday', '14:56:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (800, 2, 3, 'weekday', '15:14:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (801, 2, 3, 'weekday', '15:26:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (802, 2, 3, 'weekday', '15:38:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (803, 2, 3, 'weekday', '16:14:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (804, 2, 3, 'weekday', '16:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (805, 2, 3, 'weekday', '16:44:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (806, 2, 3, 'weekday', '17:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (807, 2, 3, 'weekday', '17:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (808, 2, 3, 'weekday', '17:38:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (809, 2, 3, 'weekday', '17:48:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (810, 2, 3, 'weekday', '18:16:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (811, 2, 3, 'weekday', '18:32:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (812, 2, 3, 'weekday', '19:12:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (813, 2, 3, 'weekday', '19:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (814, 2, 3, 'weekday', '19:48:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (815, 2, 3, 'weekday', '20:04:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (816, 2, 3, 'weekday', '20:14:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (817, 2, 3, 'weekday', '20:26:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (818, 2, 3, 'weekday', '20:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (819, 2, 3, 'weekday', '20:56:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (820, 2, 3, 'weekday', '21:08:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (821, 2, 3, 'weekday', '21:26:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (822, 2, 3, 'weekday', '21:38:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (823, 2, 3, 'weekday', '21:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (824, 3, 3, 'weekday', '06:12:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (825, 3, 3, 'weekday', '07:24:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (826, 3, 3, 'weekday', '07:54:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (827, 3, 3, 'weekday', '08:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (828, 3, 3, 'weekday', '09:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (829, 3, 3, 'weekday', '09:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (830, 3, 3, 'weekday', '10:24:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (831, 3, 3, 'weekday', '10:54:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (832, 3, 3, 'weekday', '11:08:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (833, 3, 3, 'weekday', '11:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (834, 3, 3, 'weekday', '12:28:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (835, 3, 3, 'weekday', '12:54:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (836, 3, 3, 'weekday', '13:28:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (837, 3, 3, 'weekday', '14:04:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (838, 3, 3, 'weekday', '14:28:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (839, 3, 3, 'weekday', '15:52:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (840, 3, 3, 'weekday', '16:22:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (841, 3, 3, 'weekday', '16:48:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (842, 3, 3, 'weekday', '18:58:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (843, 3, 3, 'weekday', '20:36:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (844, 3, 3, 'weekday', '20:54:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (845, 3, 3, 'weekday', '21:48:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (846, 4, 2, 'weekday', '06:12:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (847, 4, 2, 'weekday', '06:18:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (848, 4, 2, 'weekday', '06:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (849, 4, 2, 'weekday', '06:44:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (850, 4, 2, 'weekday', '06:48:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (851, 4, 2, 'weekday', '06:56:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (852, 4, 2, 'weekday', '07:06:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (853, 4, 2, 'weekday', '07:18:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (854, 4, 2, 'weekday', '07:28:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (855, 4, 2, 'weekday', '07:36:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (856, 4, 2, 'weekday', '07:46:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (857, 4, 2, 'weekday', '07:54:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (858, 4, 2, 'weekday', '08:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (859, 4, 2, 'weekday', '08:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (860, 4, 2, 'weekday', '08:28:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (861, 4, 2, 'weekday', '08:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (862, 4, 2, 'weekday', '08:46:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (863, 4, 2, 'weekday', '08:58:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (864, 4, 2, 'weekday', '09:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (865, 4, 2, 'weekday', '09:18:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (866, 4, 2, 'weekday', '09:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (867, 4, 2, 'weekday', '09:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (868, 4, 2, 'weekday', '09:52:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (869, 4, 2, 'weekday', '10:04:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (870, 4, 2, 'weekday', '10:18:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (871, 4, 2, 'weekday', '10:26:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (872, 4, 2, 'weekday', '10:42:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (873, 4, 2, 'weekday', '10:50:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (874, 4, 2, 'weekday', '11:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (875, 4, 2, 'weekday', '11:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (876, 4, 2, 'weekday', '11:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (877, 4, 2, 'weekday', '11:28:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (878, 4, 2, 'weekday', '11:36:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (879, 4, 2, 'weekday', '11:44:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (880, 4, 2, 'weekday', '11:52:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (881, 4, 2, 'weekday', '12:04:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (882, 4, 2, 'weekday', '12:14:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (883, 4, 2, 'weekday', '12:22:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (884, 4, 2, 'weekday', '12:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (885, 4, 2, 'weekday', '12:42:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (886, 4, 2, 'weekday', '12:46:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (887, 4, 2, 'weekday', '12:52:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (888, 4, 2, 'weekday', '13:02:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (889, 4, 2, 'weekday', '13:14:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (890, 4, 2, 'weekday', '13:34:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (891, 4, 2, 'weekday', '13:42:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (892, 4, 2, 'weekday', '13:48:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (893, 4, 2, 'weekday', '13:58:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (894, 4, 2, 'weekday', '14:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (895, 4, 2, 'weekday', '14:18:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (896, 4, 2, 'weekday', '14:26:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (897, 4, 2, 'weekday', '14:46:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (898, 4, 2, 'weekday', '14:52:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (899, 4, 2, 'weekday', '15:04:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (900, 4, 2, 'weekday', '15:14:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (901, 4, 2, 'weekday', '15:34:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (902, 4, 2, 'weekday', '15:46:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (903, 4, 2, 'weekday', '15:54:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (904, 4, 2, 'weekday', '16:04:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (905, 4, 2, 'weekday', '16:14:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (906, 4, 2, 'weekday', '16:20:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (907, 4, 2, 'weekday', '16:34:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (908, 4, 2, 'weekday', '16:44:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (909, 4, 2, 'weekday', '17:04:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (910, 4, 2, 'weekday', '17:18:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (911, 4, 2, 'weekday', '17:26:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (912, 4, 2, 'weekday', '17:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (913, 4, 2, 'weekday', '17:52:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (914, 4, 2, 'weekday', '18:04:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (915, 4, 2, 'weekday', '18:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (916, 4, 2, 'weekday', '18:22:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (917, 4, 2, 'weekday', '18:30:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (918, 4, 2, 'weekday', '18:40:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (919, 4, 2, 'weekday', '18:52:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (920, 4, 2, 'weekday', '19:00:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (921, 4, 2, 'weekday', '19:10:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (922, 4, 2, 'weekday', '19:24:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (923, 4, 2, 'weekday', '19:34:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (924, 4, 2, 'weekday', '19:42:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (925, 4, 2, 'weekday', '19:54:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (926, 4, 2, 'weekday', '20:04:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (927, 4, 2, 'weekday', '20:16:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (928, 4, 2, 'weekday', '20:26:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (929, 4, 2, 'weekday', '20:36:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (930, 4, 2, 'weekday', '20:44:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (931, 4, 2, 'weekday', '20:52:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (932, 4, 2, 'weekday', '21:04:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (933, 4, 2, 'weekday', '21:14:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (934, 4, 2, 'weekday', '21:24:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (935, 4, 2, 'weekday', '21:34:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (936, 4, 2, 'weekday', '21:38:00', NULL);
INSERT INTO bus_timetable_entries (id, route_id, stop_id, day_type, departure_time, note) VALUES (937, 4, 2, 'weekday', '21:48:00', NULL);


--
-- Data for Name: map_markers; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (1, 'shuttle_to_school', 'shuttle', '등교', 37.351134, 126.742043, 10, '{"showLive": true, "direction": 0, "routeCode": "등교", "routeColor": "#FF385C"}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (2, 'shuttle_from_school', 'shuttle', '하교', 37.339343, 126.732790, 20, '{"showLive": true, "direction": 1, "routeCode": "하교", "routeColor": "#FF385C"}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (13, 'shuttle2_to_campus2', 'shuttle', '제2 등교', 37.338833, 126.733778, 30, '{"showLive": true, "direction": 2, "routeCode": "제2 등교", "routeColor": "#FF385C"}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (14, 'shuttle2_from_campus2', 'shuttle', '제2 하교', 37.327877, 126.688509, 40, '{"showLive": true, "direction": 3, "routeCode": "제2 하교", "routeColor": "#FF385C"}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (15, 'shuttle2_ggotjip', 'shuttle', '꽃집앞 (제2)', 37.350833, 126.742848, 35, '{"showLive": true, "direction": 2, "routeCode": "제2 등교", "routeColor": "#FF385C", "variant": "via_station"}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (3, 'jeongwang_station', 'subway', '정왕역', 37.352618, 126.742747, 30, '{"showLive": true, "routeCode": "수인분당", "routeColor": "#F5A623", "chipVariant": "subwayMulti"}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (4, 'tec_bus_stop', 'bus', '한국공대', 37.341633, 126.731252, 40, '{"showLive": true, "routeCode": "33번", "routeColor": "#0891B2", "liveInaccurate": true, "primaryStopGbisId": "224000639"}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (5, 'bus_hub_jw_sihwa', 'bus_seoul', '3400', 37.342546, 126.735365, 50, '{}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (6, 'bus_hub_jw_emart', 'bus_seoul', '이마트', 37.345999, 126.737995, 60, '{}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (7, 'bus_hub_sl_gangnam', 'bus_seoul', '강남역', 37.498427, 127.029829, 70, '{}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (8, 'bus_hub_sl_sadang', 'bus_seoul', '사당역', 37.476654, 126.982610, 80, '{"extraPillText": "3400도 탑승 가능"}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (9, 'bus_hub_sl_seoksu', 'bus_seoul', '석수역', 37.434876, 126.902779, 90, '{}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (10, 'choji_station', 'seohae', '초지역', 37.319819, 126.807750, 100, '{"tabId": "choji", "showLive": true, "badgeText": "서", "routeCode": "서해선", "routeColor": "#75bf43"}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (11, 'siheung_station', 'seohae', '시흥시청역', 37.381656, 126.805878, 110, '{"tabId": "siheung", "showLive": true, "badgeText": "서", "routeCode": "서해선", "routeColor": "#75bf43"}', true);
INSERT INTO map_markers (id, marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES (12, 'bus_hub_sl_guro', 'bus_seoul', '구로디지털단지역', 37.485300, 126.901000, 120, '{}', true);


--
-- Data for Name: map_marker_routes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO map_marker_routes (id, marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order) VALUES (1, 5, '3400', '#DC2626', 'G', 17, 6, '{"spineLeft": "시화", "spineRight": "강남", "inboundSegment": "정왕행", "inboundDirLabel": "강남 → 학교행", "outboundSegment": "서울행", "outboundDirLabel": "학교 → 강남행", "inboundActiveSide": "left", "outboundActiveSide": "right"}', 0);
INSERT INTO map_marker_routes (id, marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order) VALUES (2, 6, '6502', '#DC2626', 'G', 2, 5, '{"spineLeft": "이마트", "spineRight": "사당", "inboundSegment": "정왕행", "inboundDirLabel": "사당 → 이마트행", "outboundSegment": "서울행", "outboundDirLabel": "이마트 → 사당행", "inboundActiveSide": "left", "outboundActiveSide": "right"}', 0);
INSERT INTO map_marker_routes (id, marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order) VALUES (3, 6, '3401', '#DC2626', 'G', 2, 7, '{"spineLeft": "이마트", "spineRight": "석수", "inboundSegment": "정왕행", "inboundDirLabel": "석수 → 이마트행", "outboundSegment": "서울행", "outboundDirLabel": "이마트 → 석수행", "inboundActiveSide": "left", "outboundActiveSide": "right"}', 10);
INSERT INTO map_marker_routes (id, marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order) VALUES (4, 7, '3400', '#DC2626', 'G', 6, 1, '{"spineLeft": "시화", "spineRight": "강남", "inboundSegment": "서울행", "inboundDirLabel": "학교 → 강남행", "outboundSegment": "정왕행", "outboundDirLabel": "강남 → 학교행", "inboundActiveSide": "right", "outboundActiveSide": "left"}', 0);
INSERT INTO map_marker_routes (id, marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order) VALUES (5, 8, '6502', '#DC2626', 'G', 5, 2, '{"spineLeft": "이마트", "spineRight": "사당", "inboundSegment": "서울행", "inboundDirLabel": "이마트 → 사당행", "outboundSegment": "정왕행", "outboundDirLabel": "사당 → 이마트행", "inboundActiveSide": "right", "outboundActiveSide": "left"}', 0);
INSERT INTO map_marker_routes (id, marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order) VALUES (6, 9, '3401', '#DC2626', 'G', 7, 2, '{"spineLeft": "이마트", "spineRight": "석수", "inboundSegment": "서울행", "inboundDirLabel": "이마트 → 석수행", "outboundSegment": "정왕행", "outboundDirLabel": "석수 → 이마트행", "inboundActiveSide": "right", "outboundActiveSide": "left"}', 0);
INSERT INTO map_marker_routes (id, marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order) VALUES (7, 6, '5602', '#DC2626', 'G', 2, 8, '{"outboundDirLabel": "이마트 → 구로행"}', 20);
INSERT INTO map_marker_routes (id, marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order) VALUES (8, 12, '5602', '#DC2626', 'G', 8, 2, '{"spineLeft": "이마트", "spineRight": "구로", "inboundSegment": "서울행", "inboundDirLabel": "이마트 → 구로행", "outboundSegment": "정왕행", "outboundDirLabel": "구로 → 이마트행", "inboundActiveSide": "right", "outboundActiveSide": "left"}', 0);
INSERT INTO map_marker_routes (id, marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order) VALUES (9, 4, '11-A', '#0891B2', NULL, 3, NULL, '{"showLive": true}', 10);
INSERT INTO map_marker_routes (id, marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order) VALUES (13, 6, '99-2', '#0D9488', 'L', 2, NULL, '{}', 30);
INSERT INTO map_marker_routes (id, marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order) VALUES (14, 5, '99-2', '#0891B2', NULL, 17, NULL, '{}', 10);


--
-- Data for Name: notices; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO notices (id, title, content, is_active, created_at, updated_at) VALUES (1, '테스트 버전입니다.', '실시간 버스 도착 시간 기능은 현재 테스트 중인 기능이므로, 정확성을 보장하지 않습니다. 나머지 정보들은 각각의 공식 시간표에서 가져옵니다.', true, '2026-04-14 04:37:16.807181+00', '2026-04-14 04:37:16.807181+00');
INSERT INTO notices (id, title, content, is_active, created_at, updated_at) VALUES (2, '버스 추가 - 3401번', '3401번 (석수 - 시흥시청 - 이마트) 버스의 시간표 데이터를 추가하였습니다. 추후 5602번 등 학교 주변에서 자주 이용하는 버스들을 추가해나가겠습니다.', true, '2026-04-15 15:50:41.226919+00', '2026-04-15 15:50:41.226919+00');
INSERT INTO notices (id, title, content, is_active, created_at, updated_at) VALUES (3, '버스 추가 - 5602번 & 과거 도착 내역 기능 추가', '5602번 (구디역 <-> 이마트, 한국공학대 시화터미널) 시간표가 추가되었습니다. \n또한, 33번과 1번 등 시간표 없이 실시간 도착 정보를 기반으로 정보를 제공하는 버스들은 이전 도착 내역들을\n시간표처럼 출력하게 하여 예측이 가능하도록 기능을 만들었습니다.\n아직 정보가 부족하므로 2~3주 정도는 더 지나야 믿을만한 정보가 모일 것으로 추측됩니다.', true, '2026-04-20 07:36:01.72572+00', '2026-04-20 07:36:01.72572+00');


--
-- Data for Name: schedule_periods; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO schedule_periods (id, period_type, name, start_date, end_date, priority, notice_message, created_at) VALUES (1, 'SEMESTER', '2026학년도 1학기', '2026-03-03', '2026-06-22', 1, NULL, '2026-04-14 04:27:55.339711+00');


--
-- Data for Name: shuttle_routes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO shuttle_routes (id, direction, description) VALUES (5, 0, '정왕역 출발 → 한국공학대학교/경기과학기술대학교 (등교)');
INSERT INTO shuttle_routes (id, direction, description) VALUES (6, 1, '한국공학대학교 본교 → 정왕역 (하교)');
INSERT INTO shuttle_routes (id, direction, description) VALUES (7, 2, '본교 출발 → 한국공학대학교 제2캠퍼스 (제2 등교)');
INSERT INTO shuttle_routes (id, direction, description) VALUES (8, 3, '한국공학대학교 제2캠퍼스 → 본교 (제2 하교)');


--
-- Data for Name: shuttle_timetable_entries; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (1, 1, 6, 'weekday', '09:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (2, 1, 6, 'weekday', '09:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (3, 1, 6, 'weekday', '09:40:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (4, 1, 6, 'weekday', '10:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (5, 1, 6, 'weekday', '10:05:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (6, 1, 6, 'weekday', '10:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (7, 1, 6, 'weekday', '10:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (8, 1, 6, 'weekday', '10:40:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (9, 1, 6, 'weekday', '10:50:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (10, 1, 6, 'weekday', '11:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (11, 1, 6, 'weekday', '11:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (12, 1, 6, 'weekday', '11:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (13, 1, 6, 'weekday', '11:40:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (14, 1, 6, 'weekday', '11:50:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (15, 1, 6, 'weekday', '12:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (16, 1, 6, 'weekday', '12:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (17, 1, 6, 'weekday', '12:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (18, 1, 6, 'weekday', '12:40:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (19, 1, 6, 'weekday', '12:50:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (20, 1, 6, 'weekday', '13:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (21, 1, 6, 'weekday', '13:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (22, 1, 6, 'weekday', '13:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (23, 1, 6, 'weekday', '13:40:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (24, 1, 6, 'weekday', '13:50:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (25, 1, 6, 'weekday', '14:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (26, 1, 6, 'weekday', '14:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (27, 1, 6, 'weekday', '14:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (28, 1, 6, 'weekday', '14:50:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (29, 1, 6, 'weekday', '15:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (30, 1, 6, 'weekday', '15:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (31, 1, 6, 'weekday', '15:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (32, 1, 6, 'weekday', '15:50:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (33, 1, 6, 'weekday', '16:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (34, 1, 6, 'weekday', '16:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (35, 1, 6, 'weekday', '16:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (36, 1, 6, 'weekday', '16:40:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (37, 1, 6, 'weekday', '16:50:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (38, 1, 6, 'weekday', '17:00:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (39, 1, 6, 'weekday', '17:10:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (40, 1, 6, 'weekday', '17:20:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (41, 1, 6, 'weekday', '17:30:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (42, 1, 6, 'weekday', '17:40:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (43, 1, 6, 'weekday', '17:50:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (44, 1, 6, 'weekday', '18:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (45, 1, 6, 'weekday', '18:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (46, 1, 6, 'weekday', '18:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (47, 1, 6, 'weekday', '18:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (48, 1, 6, 'weekday', '18:40:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (49, 1, 6, 'weekday', '18:50:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (50, 1, 6, 'weekday', '19:05:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (51, 1, 6, 'weekday', '19:15:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (52, 1, 6, 'weekday', '19:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (53, 1, 6, 'weekday', '19:45:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (54, 1, 6, 'weekday', '20:05:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (55, 1, 6, 'weekday', '20:25:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (56, 1, 6, 'weekday', '20:45:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (57, 1, 6, 'weekday', '21:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (58, 1, 6, 'weekday', '21:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (59, 1, 6, 'weekday', '21:48:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (60, 1, 6, 'weekday', '22:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (61, 1, 6, 'weekday', '22:40:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (62, 1, 5, 'weekday', '08:40:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (63, 1, 5, 'weekday', '08:50:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (64, 1, 5, 'weekday', '09:00:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (65, 1, 5, 'weekday', '09:10:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (66, 1, 5, 'weekday', '09:20:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (67, 1, 5, 'weekday', '09:30:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (68, 1, 5, 'weekday', '09:40:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (69, 1, 5, 'weekday', '09:50:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (70, 1, 5, 'weekday', '10:00:00', '수시운행');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (71, 1, 5, 'weekday', '10:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (72, 1, 5, 'weekday', '10:15:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (73, 1, 5, 'weekday', '10:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (74, 1, 5, 'weekday', '10:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (75, 1, 5, 'weekday', '10:50:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (76, 1, 5, 'weekday', '11:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (77, 1, 5, 'weekday', '11:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (78, 1, 5, 'weekday', '11:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (79, 1, 5, 'weekday', '11:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (80, 1, 5, 'weekday', '11:50:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (81, 1, 5, 'weekday', '12:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (82, 1, 5, 'weekday', '12:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (83, 1, 5, 'weekday', '12:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (84, 1, 5, 'weekday', '12:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (85, 1, 5, 'weekday', '12:50:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (86, 1, 5, 'weekday', '13:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (87, 1, 5, 'weekday', '13:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (88, 1, 5, 'weekday', '13:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (89, 1, 5, 'weekday', '13:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (90, 1, 5, 'weekday', '13:50:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (91, 1, 5, 'weekday', '14:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (92, 1, 5, 'weekday', '14:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (93, 1, 5, 'weekday', '14:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (94, 1, 5, 'weekday', '14:40:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (95, 1, 5, 'weekday', '15:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (96, 1, 5, 'weekday', '15:10:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (97, 1, 5, 'weekday', '15:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (98, 1, 5, 'weekday', '15:40:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (99, 1, 5, 'weekday', '16:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (100, 1, 5, 'weekday', '16:20:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (101, 1, 5, 'weekday', '16:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (102, 1, 5, 'weekday', '16:40:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (103, 1, 5, 'weekday', '16:50:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (104, 1, 5, 'weekday', '17:10:00', '회차편 · 학교 수시운행 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (105, 1, 5, 'weekday', '18:10:00', '회차편 · 학교 18:00 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (106, 1, 5, 'weekday', '18:20:00', '회차편 · 학교 18:10 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (107, 1, 5, 'weekday', '18:30:00', '회차편 · 학교 18:20 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (108, 1, 5, 'weekday', '18:40:00', '회차편 · 학교 18:30 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (109, 1, 5, 'weekday', '18:50:00', '회차편 · 학교 18:40 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (110, 1, 5, 'weekday', '19:00:00', '회차편 · 학교 18:50 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (111, 1, 5, 'weekday', '19:15:00', '회차편 · 학교 19:05 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (112, 1, 5, 'weekday', '19:25:00', '회차편 · 학교 19:15 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (113, 1, 5, 'weekday', '19:40:00', '회차편 · 학교 19:30 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (114, 1, 5, 'weekday', '19:55:00', '회차편 · 학교 19:45 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (115, 1, 5, 'weekday', '20:15:00', '회차편 · 학교 20:05 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (116, 1, 5, 'weekday', '20:35:00', '회차편 · 학교 20:25 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (117, 1, 5, 'weekday', '20:55:00', '회차편 · 학교 20:45 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (118, 1, 5, 'weekday', '21:10:00', '회차편 · 학교 21:00 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (119, 1, 5, 'weekday', '21:30:00', '회차편 · 학교 21:20 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (120, 1, 5, 'weekday', '21:58:00', '회차편 · 학교 21:48 출발');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (121, 1, 5, 'weekday', '22:17:00', '막차');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (122, 1, 7, 'weekday', '08:55:00', '정왕역 08:55 출발 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (123, 1, 7, 'weekday', '09:00:00', '정왕역 09:00 출발 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (124, 1, 7, 'weekday', '10:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (125, 1, 7, 'weekday', '11:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (126, 1, 7, 'weekday', '12:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (127, 1, 7, 'weekday', '13:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (128, 1, 7, 'weekday', '14:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (129, 1, 7, 'weekday', '15:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (130, 1, 7, 'weekday', '16:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (131, 1, 7, 'weekday', '17:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (132, 1, 7, 'weekday', '18:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (133, 1, 7, 'weekday', '19:00:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (134, 1, 8, 'weekday', '09:40:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (135, 1, 8, 'weekday', '10:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (136, 1, 8, 'weekday', '11:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (137, 1, 8, 'weekday', '12:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (138, 1, 8, 'weekday', '13:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (139, 1, 8, 'weekday', '14:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (140, 1, 8, 'weekday', '15:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (141, 1, 8, 'weekday', '16:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (142, 1, 8, 'weekday', '17:40:00', '오이도역 도착');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (143, 1, 8, 'weekday', '18:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (144, 1, 8, 'weekday', '19:30:00', NULL);
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (145, 1, 7, 'saturday', '08:45:00', '정왕역 출발 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (146, 1, 7, 'saturday', '08:50:00', '정왕역 출발 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (147, 1, 7, 'saturday', '09:00:00', '정왕역 출발 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (148, 1, 7, 'saturday', '09:05:00', '정왕역 출발 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (149, 1, 7, 'saturday', '09:10:00', '정왕역 출발 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (150, 1, 7, 'saturday', '09:15:00', '정왕역 출발 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (151, 1, 8, 'saturday', '16:30:00', '정왕역 종착 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (152, 1, 8, 'saturday', '16:45:00', '정왕역 종착 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (153, 1, 8, 'saturday', '19:25:00', '정왕역 종착 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (154, 1, 8, 'saturday', '19:28:00', '정왕역 종착 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (155, 1, 8, 'saturday', '19:30:00', '정왕역 종착 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (156, 1, 8, 'saturday', '19:35:00', '정왕역 종착 (서문 경유)');
INSERT INTO shuttle_timetable_entries (id, schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES (157, 1, 8, 'saturday', '19:45:00', '정왕역 종착 (서문 경유)');


--
-- Data for Name: subway_timetable_entries; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1072, 'up', 'weekday', '05:39:00', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1073, 'up', 'weekday', '06:01:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1074, 'up', 'weekday', '06:30:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1075, 'up', 'weekday', '06:47:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1076, 'up', 'weekday', '07:04:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1077, 'up', 'weekday', '07:17:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1078, 'up', 'weekday', '07:34:00', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1079, 'up', 'weekday', '07:46:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1080, 'up', 'weekday', '07:58:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1081, 'up', 'weekday', '08:18:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1082, 'up', 'weekday', '08:33:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1083, 'up', 'weekday', '08:49:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1084, 'up', 'weekday', '09:01:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1085, 'up', 'weekday', '09:12:30', '죽전(단국대)', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1086, 'up', 'weekday', '09:31:30', '청량리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1087, 'up', 'weekday', '09:48:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1088, 'up', 'weekday', '10:13:30', '청량리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1089, 'up', 'weekday', '10:32:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1090, 'up', 'weekday', '10:58:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1091, 'up', 'weekday', '11:16:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1092, 'up', 'weekday', '11:44:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1093, 'up', 'weekday', '12:04:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1094, 'up', 'weekday', '12:29:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1095, 'up', 'weekday', '12:47:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1096, 'up', 'weekday', '13:13:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1097, 'up', 'weekday', '13:29:30', '청량리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1098, 'up', 'weekday', '13:58:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1099, 'up', 'weekday', '14:17:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1100, 'up', 'weekday', '14:48:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1101, 'up', 'weekday', '15:03:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1102, 'up', 'weekday', '15:33:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1103, 'up', 'weekday', '15:45:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1104, 'up', 'weekday', '16:21:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1105, 'up', 'weekday', '16:35:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1106, 'up', 'weekday', '17:00:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1107, 'up', 'weekday', '17:14:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1108, 'up', 'weekday', '17:50:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1109, 'up', 'weekday', '18:04:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1110, 'up', 'weekday', '18:18:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1111, 'up', 'weekday', '18:32:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1112, 'up', 'weekday', '18:47:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1113, 'up', 'weekday', '19:20:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1114, 'up', 'weekday', '19:46:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1115, 'up', 'weekday', '20:03:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1116, 'up', 'weekday', '20:35:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1117, 'up', 'weekday', '21:01:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1118, 'up', 'weekday', '21:17:00', '죽전(단국대)', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1119, 'up', 'weekday', '21:30:30', '죽전(단국대)', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1120, 'up', 'weekday', '21:44:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1121, 'up', 'weekday', '22:05:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1122, 'up', 'weekday', '22:37:30', '죽전(단국대)', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1123, 'up', 'weekday', '23:04:30', '죽전(단국대)', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1124, 'up', 'weekday', '23:36:30', '고색', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1125, 'down', 'weekday', '00:21:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1126, 'down', 'weekday', '05:54:00', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1127, 'down', 'weekday', '06:09:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1128, 'down', 'weekday', '06:27:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1129, 'down', 'weekday', '06:44:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1130, 'down', 'weekday', '07:09:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1131, 'down', 'weekday', '07:33:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1132, 'down', 'weekday', '07:44:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1133, 'down', 'weekday', '08:02:00', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1134, 'down', 'weekday', '08:17:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1135, 'down', 'weekday', '08:32:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1136, 'down', 'weekday', '08:46:00', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1247, 'down', 'sunday', '22:44:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1137, 'down', 'weekday', '09:03:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1138, 'down', 'weekday', '09:16:00', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1139, 'down', 'weekday', '09:33:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1140, 'down', 'weekday', '09:55:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1141, 'down', 'weekday', '10:23:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1142, 'down', 'weekday', '10:35:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1143, 'down', 'weekday', '11:05:00', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1144, 'down', 'weekday', '11:18:00', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1145, 'down', 'weekday', '11:50:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1146, 'down', 'weekday', '12:12:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1147, 'down', 'weekday', '12:43:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1148, 'down', 'weekday', '12:56:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1149, 'down', 'weekday', '13:27:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1150, 'down', 'weekday', '13:39:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1151, 'down', 'weekday', '14:08:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1152, 'down', 'weekday', '14:28:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1153, 'down', 'weekday', '14:52:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1154, 'down', 'weekday', '15:10:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1155, 'down', 'weekday', '15:47:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1156, 'down', 'weekday', '15:58:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1157, 'down', 'weekday', '16:23:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1158, 'down', 'weekday', '16:42:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1159, 'down', 'weekday', '17:08:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1160, 'down', 'weekday', '17:25:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1161, 'down', 'weekday', '18:01:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1162, 'down', 'weekday', '18:12:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1163, 'down', 'weekday', '18:43:00', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1164, 'down', 'weekday', '18:57:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1165, 'down', 'weekday', '19:11:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1166, 'down', 'weekday', '19:25:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1167, 'down', 'weekday', '20:03:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1168, 'down', 'weekday', '20:15:00', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1169, 'down', 'weekday', '20:47:00', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1170, 'down', 'weekday', '21:23:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1171, 'down', 'weekday', '21:45:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1172, 'down', 'weekday', '22:09:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1173, 'down', 'weekday', '22:32:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1174, 'down', 'weekday', '22:51:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1175, 'down', 'weekday', '23:20:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1176, 'down', 'weekday', '23:37:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1177, 'down', 'weekday', '23:55:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1178, 'up', 'sunday', '05:41:00', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1179, 'up', 'sunday', '06:03:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1180, 'up', 'sunday', '06:37:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1181, 'up', 'sunday', '07:05:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1182, 'up', 'sunday', '07:33:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1183, 'up', 'sunday', '08:07:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1184, 'up', 'sunday', '08:35:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1185, 'up', 'sunday', '09:07:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1186, 'up', 'sunday', '09:36:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1187, 'up', 'sunday', '10:03:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1188, 'up', 'sunday', '10:37:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1189, 'up', 'sunday', '11:02:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1190, 'up', 'sunday', '11:34:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1191, 'up', 'sunday', '12:07:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1192, 'up', 'sunday', '12:33:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1193, 'up', 'sunday', '13:06:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1194, 'up', 'sunday', '13:33:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1195, 'up', 'sunday', '14:03:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1196, 'up', 'sunday', '14:37:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1197, 'up', 'sunday', '15:03:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1198, 'up', 'sunday', '15:36:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1199, 'up', 'sunday', '16:08:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1200, 'up', 'sunday', '16:34:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1201, 'up', 'sunday', '17:00:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1202, 'up', 'sunday', '17:34:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1203, 'up', 'sunday', '18:00:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1204, 'up', 'sunday', '18:30:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1205, 'up', 'sunday', '19:03:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1206, 'up', 'sunday', '19:30:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1207, 'up', 'sunday', '20:08:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1208, 'up', 'sunday', '20:33:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1209, 'up', 'sunday', '21:08:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1210, 'up', 'sunday', '21:53:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1211, 'up', 'sunday', '22:23:30', '왕십리', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1212, 'up', 'sunday', '22:58:30', '죽전(단국대)', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1213, 'up', 'sunday', '23:33:30', '고색', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1214, 'down', 'sunday', '00:05:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1215, 'down', 'sunday', '06:04:00', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1216, 'down', 'sunday', '06:35:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1217, 'down', 'sunday', '07:18:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1218, 'down', 'sunday', '07:54:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1219, 'down', 'sunday', '08:27:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1220, 'down', 'sunday', '08:57:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1221, 'down', 'sunday', '09:24:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1222, 'down', 'sunday', '09:57:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1223, 'down', 'sunday', '10:24:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1224, 'down', 'sunday', '10:57:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1225, 'down', 'sunday', '11:27:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1226, 'down', 'sunday', '11:54:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1227, 'down', 'sunday', '12:27:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1228, 'down', 'sunday', '12:54:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1229, 'down', 'sunday', '13:31:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1230, 'down', 'sunday', '13:58:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1231, 'down', 'sunday', '14:23:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1232, 'down', 'sunday', '14:57:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1233, 'down', 'sunday', '15:23:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1234, 'down', 'sunday', '15:53:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1235, 'down', 'sunday', '16:27:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1236, 'down', 'sunday', '17:02:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1237, 'down', 'sunday', '17:28:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1238, 'down', 'sunday', '17:57:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1239, 'down', 'sunday', '18:31:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1240, 'down', 'sunday', '18:57:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1241, 'down', 'sunday', '19:24:00', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1242, 'down', 'sunday', '19:55:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1243, 'down', 'sunday', '20:27:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1244, 'down', 'sunday', '20:54:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1245, 'down', 'sunday', '21:29:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1246, 'down', 'sunday', '21:56:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1248, 'down', 'sunday', '23:11:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1249, 'down', 'sunday', '23:41:30', '인천', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1250, 'line4_up', 'weekday', '00:05:00', '금정', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1251, 'line4_up', 'weekday', '05:16:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1252, 'line4_up', 'weekday', '05:24:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1253, 'line4_up', 'weekday', '05:35:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1254, 'line4_up', 'weekday', '05:42:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1255, 'line4_up', 'weekday', '05:47:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1256, 'line4_up', 'weekday', '05:56:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1257, 'line4_up', 'weekday', '06:05:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1258, 'line4_up', 'weekday', '06:13:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1259, 'line4_up', 'weekday', '06:20:30', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1260, 'line4_up', 'weekday', '06:33:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1261, 'line4_up', 'weekday', '06:45:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1262, 'line4_up', 'weekday', '06:51:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1263, 'line4_up', 'weekday', '06:57:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1264, 'line4_up', 'weekday', '07:02:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1265, 'line4_up', 'weekday', '07:13:30', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1266, 'line4_up', 'weekday', '07:21:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1267, 'line4_up', 'weekday', '07:27:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1268, 'line4_up', 'weekday', '07:31:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1269, 'line4_up', 'weekday', '07:37:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1270, 'line4_up', 'weekday', '07:42:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1271, 'line4_up', 'weekday', '07:52:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1272, 'line4_up', 'weekday', '07:55:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1273, 'line4_up', 'weekday', '08:02:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1274, 'line4_up', 'weekday', '08:06:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1275, 'line4_up', 'weekday', '08:14:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1276, 'line4_up', 'weekday', '08:29:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1277, 'line4_up', 'weekday', '08:45:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1278, 'line4_up', 'weekday', '08:55:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1279, 'line4_up', 'weekday', '09:05:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1280, 'line4_up', 'weekday', '09:15:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1281, 'line4_up', 'weekday', '09:25:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1282, 'line4_up', 'weekday', '09:35:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1283, 'line4_up', 'weekday', '09:45:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1284, 'line4_up', 'weekday', '09:54:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1285, 'line4_up', 'weekday', '10:05:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1286, 'line4_up', 'weekday', '10:16:30', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1287, 'line4_up', 'weekday', '10:25:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1288, 'line4_up', 'weekday', '10:28:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1289, 'line4_up', 'weekday', '10:38:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1290, 'line4_up', 'weekday', '10:52:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1291, 'line4_up', 'weekday', '11:02:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1292, 'line4_up', 'weekday', '11:12:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1293, 'line4_up', 'weekday', '11:30:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1294, 'line4_up', 'weekday', '11:40:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1295, 'line4_up', 'weekday', '11:48:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1296, 'line4_up', 'weekday', '11:58:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1297, 'line4_up', 'weekday', '12:09:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1298, 'line4_up', 'weekday', '12:23:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1299, 'line4_up', 'weekday', '12:34:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1300, 'line4_up', 'weekday', '12:43:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1301, 'line4_up', 'weekday', '12:53:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1302, 'line4_up', 'weekday', '13:05:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1303, 'line4_up', 'weekday', '13:17:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1304, 'line4_up', 'weekday', '13:23:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1305, 'line4_up', 'weekday', '13:35:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1306, 'line4_up', 'weekday', '13:47:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1307, 'line4_up', 'weekday', '14:02:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1308, 'line4_up', 'weekday', '14:12:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1309, 'line4_up', 'weekday', '14:26:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1310, 'line4_up', 'weekday', '14:37:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1311, 'line4_up', 'weekday', '14:45:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1312, 'line4_up', 'weekday', '14:59:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1313, 'line4_up', 'weekday', '15:11:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1314, 'line4_up', 'weekday', '15:22:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1315, 'line4_up', 'weekday', '15:28:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1316, 'line4_up', 'weekday', '15:40:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1317, 'line4_up', 'weekday', '15:51:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1318, 'line4_up', 'weekday', '15:58:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1319, 'line4_up', 'weekday', '16:07:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1320, 'line4_up', 'weekday', '16:18:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1321, 'line4_up', 'weekday', '16:32:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1322, 'line4_up', 'weekday', '16:41:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1323, 'line4_up', 'weekday', '16:56:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1324, 'line4_up', 'weekday', '17:11:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1325, 'line4_up', 'weekday', '17:18:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1326, 'line4_up', 'weekday', '17:32:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1327, 'line4_up', 'weekday', '17:39:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1328, 'line4_up', 'weekday', '17:46:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1329, 'line4_up', 'weekday', '17:54:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1330, 'line4_up', 'weekday', '18:00:30', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1331, 'line4_up', 'weekday', '18:08:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1332, 'line4_up', 'weekday', '18:14:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1333, 'line4_up', 'weekday', '18:22:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1334, 'line4_up', 'weekday', '18:28:30', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1335, 'line4_up', 'weekday', '18:36:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1336, 'line4_up', 'weekday', '18:44:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1337, 'line4_up', 'weekday', '18:53:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1338, 'line4_up', 'weekday', '19:00:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1339, 'line4_up', 'weekday', '19:09:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1340, 'line4_up', 'weekday', '19:16:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1341, 'line4_up', 'weekday', '19:25:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1342, 'line4_up', 'weekday', '19:34:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1343, 'line4_up', 'weekday', '19:51:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1344, 'line4_up', 'weekday', '19:57:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1345, 'line4_up', 'weekday', '20:07:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1346, 'line4_up', 'weekday', '20:20:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1347, 'line4_up', 'weekday', '20:31:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1348, 'line4_up', 'weekday', '20:44:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1349, 'line4_up', 'weekday', '20:58:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1350, 'line4_up', 'weekday', '21:06:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1351, 'line4_up', 'weekday', '21:21:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1352, 'line4_up', 'weekday', '21:35:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1353, 'line4_up', 'weekday', '21:49:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1354, 'line4_up', 'weekday', '22:02:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1355, 'line4_up', 'weekday', '22:16:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1356, 'line4_up', 'weekday', '22:29:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1357, 'line4_up', 'weekday', '22:42:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1358, 'line4_up', 'weekday', '22:59:30', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1359, 'line4_up', 'weekday', '23:32:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1360, 'line4_down', 'weekday', '00:04:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1361, 'line4_down', 'weekday', '00:28:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1362, 'line4_down', 'weekday', '05:36:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1363, 'line4_down', 'weekday', '06:17:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1364, 'line4_down', 'weekday', '06:33:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1365, 'line4_down', 'weekday', '06:48:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1366, 'line4_down', 'weekday', '07:05:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1367, 'line4_down', 'weekday', '07:17:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1368, 'line4_down', 'weekday', '07:28:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1369, 'line4_down', 'weekday', '07:38:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1370, 'line4_down', 'weekday', '07:48:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1371, 'line4_down', 'weekday', '07:57:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1372, 'line4_down', 'weekday', '08:05:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1373, 'line4_down', 'weekday', '08:13:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1374, 'line4_down', 'weekday', '08:29:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1375, 'line4_down', 'weekday', '08:36:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1376, 'line4_down', 'weekday', '08:49:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1377, 'line4_down', 'weekday', '08:54:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1378, 'line4_down', 'weekday', '09:00:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1379, 'line4_down', 'weekday', '09:07:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1380, 'line4_down', 'weekday', '09:20:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1381, 'line4_down', 'weekday', '09:24:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1382, 'line4_down', 'weekday', '09:37:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1383, 'line4_down', 'weekday', '09:42:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1384, 'line4_down', 'weekday', '09:48:00', '', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1385, 'line4_down', 'weekday', '10:00:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1386, 'line4_down', 'weekday', '10:07:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1387, 'line4_down', 'weekday', '10:14:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1388, 'line4_down', 'weekday', '10:20:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1389, 'line4_down', 'weekday', '10:32:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1390, 'line4_down', 'weekday', '10:39:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1391, 'line4_down', 'weekday', '10:51:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1392, 'line4_down', 'weekday', '11:01:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1393, 'line4_down', 'weekday', '11:11:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1394, 'line4_down', 'weekday', '11:21:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1395, 'line4_down', 'weekday', '11:34:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1396, 'line4_down', 'weekday', '11:44:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1397, 'line4_down', 'weekday', '11:54:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1398, 'line4_down', 'weekday', '12:05:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1399, 'line4_down', 'weekday', '12:16:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1400, 'line4_down', 'weekday', '12:27:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1401, 'line4_down', 'weekday', '12:38:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1402, 'line4_down', 'weekday', '12:49:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1403, 'line4_down', 'weekday', '13:00:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1404, 'line4_down', 'weekday', '13:07:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1405, 'line4_down', 'weekday', '13:19:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1406, 'line4_down', 'weekday', '13:31:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1407, 'line4_down', 'weekday', '13:50:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1408, 'line4_down', 'weekday', '14:01:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1409, 'line4_down', 'weekday', '14:12:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1410, 'line4_down', 'weekday', '14:23:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1411, 'line4_down', 'weekday', '14:34:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1412, 'line4_down', 'weekday', '14:45:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1413, 'line4_down', 'weekday', '14:56:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1414, 'line4_down', 'weekday', '15:06:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1415, 'line4_down', 'weekday', '15:14:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1416, 'line4_down', 'weekday', '15:25:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1417, 'line4_down', 'weekday', '15:35:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1418, 'line4_down', 'weekday', '15:43:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1419, 'line4_down', 'weekday', '15:53:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1420, 'line4_down', 'weekday', '16:04:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1421, 'line4_down', 'weekday', '16:18:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1422, 'line4_down', 'weekday', '16:29:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1423, 'line4_down', 'weekday', '16:38:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1424, 'line4_down', 'weekday', '16:49:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1425, 'line4_down', 'weekday', '17:00:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1426, 'line4_down', 'weekday', '17:12:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1427, 'line4_down', 'weekday', '17:18:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1428, 'line4_down', 'weekday', '17:31:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1429, 'line4_down', 'weekday', '17:42:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1430, 'line4_down', 'weekday', '17:47:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1431, 'line4_down', 'weekday', '17:57:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1432, 'line4_down', 'weekday', '18:07:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1433, 'line4_down', 'weekday', '18:21:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1434, 'line4_down', 'weekday', '18:31:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1435, 'line4_down', 'weekday', '18:39:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1436, 'line4_down', 'weekday', '18:46:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1437, 'line4_down', 'weekday', '18:53:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1438, 'line4_down', 'weekday', '19:01:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1439, 'line4_down', 'weekday', '19:08:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1440, 'line4_down', 'weekday', '19:15:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1441, 'line4_down', 'weekday', '19:22:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1442, 'line4_down', 'weekday', '19:29:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1443, 'line4_down', 'weekday', '19:35:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1444, 'line4_down', 'weekday', '19:45:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1445, 'line4_down', 'weekday', '19:51:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1446, 'line4_down', 'weekday', '19:57:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1447, 'line4_down', 'weekday', '20:06:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1448, 'line4_down', 'weekday', '20:19:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1449, 'line4_down', 'weekday', '20:25:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1450, 'line4_down', 'weekday', '20:36:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1451, 'line4_down', 'weekday', '20:43:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1452, 'line4_down', 'weekday', '20:50:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1453, 'line4_down', 'weekday', '20:58:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1454, 'line4_down', 'weekday', '21:06:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1455, 'line4_down', 'weekday', '21:14:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1456, 'line4_down', 'weekday', '21:17:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1457, 'line4_down', 'weekday', '21:33:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1458, 'line4_down', 'weekday', '21:40:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1459, 'line4_down', 'weekday', '21:49:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1460, 'line4_down', 'weekday', '21:56:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1461, 'line4_down', 'weekday', '22:04:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1462, 'line4_down', 'weekday', '22:17:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1463, 'line4_down', 'weekday', '22:26:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1464, 'line4_down', 'weekday', '22:36:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1465, 'line4_down', 'weekday', '22:48:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1466, 'line4_down', 'weekday', '22:55:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1467, 'line4_down', 'weekday', '23:11:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1468, 'line4_down', 'weekday', '23:24:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1469, 'line4_down', 'weekday', '23:41:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1470, 'line4_down', 'weekday', '23:52:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1471, 'line4_up', 'sunday', '05:33:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1472, 'line4_up', 'sunday', '05:45:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1473, 'line4_up', 'sunday', '05:57:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1474, 'line4_up', 'sunday', '06:09:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1475, 'line4_up', 'sunday', '06:21:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1476, 'line4_up', 'sunday', '06:33:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1477, 'line4_up', 'sunday', '06:45:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1478, 'line4_up', 'sunday', '06:57:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1479, 'line4_up', 'sunday', '07:09:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1480, 'line4_up', 'sunday', '07:21:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1481, 'line4_up', 'sunday', '07:27:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1482, 'line4_up', 'sunday', '07:39:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1483, 'line4_up', 'sunday', '07:51:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1484, 'line4_up', 'sunday', '08:03:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1485, 'line4_up', 'sunday', '08:18:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1486, 'line4_up', 'sunday', '08:28:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1487, 'line4_up', 'sunday', '08:39:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1488, 'line4_up', 'sunday', '08:51:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1489, 'line4_up', 'sunday', '09:03:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1490, 'line4_up', 'sunday', '09:15:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1491, 'line4_up', 'sunday', '09:27:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1492, 'line4_up', 'sunday', '09:32:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1493, 'line4_up', 'sunday', '09:44:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1494, 'line4_up', 'sunday', '09:56:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1495, 'line4_up', 'sunday', '10:08:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1496, 'line4_up', 'sunday', '10:17:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1497, 'line4_up', 'sunday', '10:24:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1498, 'line4_up', 'sunday', '10:33:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1499, 'line4_up', 'sunday', '10:43:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1500, 'line4_up', 'sunday', '10:48:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1501, 'line4_up', 'sunday', '10:58:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1502, 'line4_up', 'sunday', '11:08:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1503, 'line4_up', 'sunday', '11:13:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1504, 'line4_up', 'sunday', '11:23:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1505, 'line4_up', 'sunday', '11:38:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1506, 'line4_up', 'sunday', '11:54:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1507, 'line4_up', 'sunday', '12:03:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1508, 'line4_up', 'sunday', '12:13:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1509, 'line4_up', 'sunday', '12:23:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1510, 'line4_up', 'sunday', '12:28:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1511, 'line4_up', 'sunday', '12:38:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1512, 'line4_up', 'sunday', '12:54:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1513, 'line4_up', 'sunday', '13:03:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1514, 'line4_up', 'sunday', '13:13:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1515, 'line4_up', 'sunday', '13:18:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1516, 'line4_up', 'sunday', '13:28:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1517, 'line4_up', 'sunday', '13:38:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1518, 'line4_up', 'sunday', '13:43:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1519, 'line4_up', 'sunday', '13:59:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1520, 'line4_up', 'sunday', '14:18:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1521, 'line4_up', 'sunday', '14:28:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1522, 'line4_up', 'sunday', '14:43:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1523, 'line4_up', 'sunday', '14:51:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1524, 'line4_up', 'sunday', '14:59:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1525, 'line4_up', 'sunday', '15:08:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1526, 'line4_up', 'sunday', '15:17:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1527, 'line4_up', 'sunday', '15:24:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1528, 'line4_up', 'sunday', '15:33:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1529, 'line4_up', 'sunday', '15:48:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1530, 'line4_up', 'sunday', '15:57:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1531, 'line4_up', 'sunday', '16:13:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1532, 'line4_up', 'sunday', '16:23:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1533, 'line4_up', 'sunday', '16:38:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1534, 'line4_up', 'sunday', '16:53:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1535, 'line4_up', 'sunday', '17:04:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1536, 'line4_up', 'sunday', '17:15:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1537, 'line4_up', 'sunday', '17:25:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1538, 'line4_up', 'sunday', '17:40:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1539, 'line4_up', 'sunday', '17:52:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1540, 'line4_up', 'sunday', '18:10:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1541, 'line4_up', 'sunday', '18:22:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1542, 'line4_up', 'sunday', '18:34:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1543, 'line4_up', 'sunday', '18:46:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1544, 'line4_up', 'sunday', '18:58:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1545, 'line4_up', 'sunday', '19:10:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1546, 'line4_up', 'sunday', '19:22:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1547, 'line4_up', 'sunday', '19:34:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1548, 'line4_up', 'sunday', '19:45:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1549, 'line4_up', 'sunday', '19:53:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1550, 'line4_up', 'sunday', '20:04:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1551, 'line4_up', 'sunday', '20:16:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1552, 'line4_up', 'sunday', '20:28:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1553, 'line4_up', 'sunday', '20:40:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1554, 'line4_up', 'sunday', '20:52:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1555, 'line4_up', 'sunday', '21:04:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1556, 'line4_up', 'sunday', '21:16:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1557, 'line4_up', 'sunday', '21:28:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1558, 'line4_up', 'sunday', '21:44:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1559, 'line4_up', 'sunday', '22:00:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1560, 'line4_up', 'sunday', '22:16:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1561, 'line4_up', 'sunday', '22:32:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1562, 'line4_up', 'sunday', '22:44:00', '금정', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1563, 'line4_up', 'sunday', '23:02:00', '당고개', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1564, 'line4_up', 'sunday', '23:27:00', '금정', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1565, 'line4_down', 'sunday', '00:01:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1566, 'line4_down', 'sunday', '06:14:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1567, 'line4_down', 'sunday', '06:31:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1568, 'line4_down', 'sunday', '06:49:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1569, 'line4_down', 'sunday', '07:06:00', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1570, 'line4_down', 'sunday', '07:22:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1571, 'line4_down', 'sunday', '07:34:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1572, 'line4_down', 'sunday', '07:46:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1573, 'line4_down', 'sunday', '08:10:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1574, 'line4_down', 'sunday', '08:22:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1575, 'line4_down', 'sunday', '08:34:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1576, 'line4_down', 'sunday', '08:46:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1577, 'line4_down', 'sunday', '08:52:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1578, 'line4_down', 'sunday', '09:04:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1579, 'line4_down', 'sunday', '09:21:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1580, 'line4_down', 'sunday', '09:28:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1581, 'line4_down', 'sunday', '09:40:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1582, 'line4_down', 'sunday', '09:52:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1583, 'line4_down', 'sunday', '10:04:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1584, 'line4_down', 'sunday', '10:16:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1585, 'line4_down', 'sunday', '10:28:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1586, 'line4_down', 'sunday', '10:40:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1587, 'line4_down', 'sunday', '10:52:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1588, 'line4_down', 'sunday', '11:04:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1589, 'line4_down', 'sunday', '11:22:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1590, 'line4_down', 'sunday', '11:34:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1591, 'line4_down', 'sunday', '11:46:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1592, 'line4_down', 'sunday', '11:58:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1593, 'line4_down', 'sunday', '12:10:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1594, 'line4_down', 'sunday', '12:22:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1595, 'line4_down', 'sunday', '12:34:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1596, 'line4_down', 'sunday', '12:46:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1597, 'line4_down', 'sunday', '12:58:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1598, 'line4_down', 'sunday', '13:10:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1599, 'line4_down', 'sunday', '13:22:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1600, 'line4_down', 'sunday', '13:27:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1601, 'line4_down', 'sunday', '13:43:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1602, 'line4_down', 'sunday', '13:52:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1603, 'line4_down', 'sunday', '14:02:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1604, 'line4_down', 'sunday', '14:12:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1605, 'line4_down', 'sunday', '14:27:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1606, 'line4_down', 'sunday', '14:35:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1607, 'line4_down', 'sunday', '14:43:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1608, 'line4_down', 'sunday', '14:52:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1609, 'line4_down', 'sunday', '15:02:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1610, 'line4_down', 'sunday', '15:07:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1611, 'line4_down', 'sunday', '15:17:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1612, 'line4_down', 'sunday', '15:32:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1613, 'line4_down', 'sunday', '15:48:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1614, 'line4_down', 'sunday', '15:57:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1615, 'line4_down', 'sunday', '16:07:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1616, 'line4_down', 'sunday', '16:22:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1617, 'line4_down', 'sunday', '16:32:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1618, 'line4_down', 'sunday', '16:40:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1619, 'line4_down', 'sunday', '16:57:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1620, 'line4_down', 'sunday', '17:07:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1621, 'line4_down', 'sunday', '17:22:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1622, 'line4_down', 'sunday', '17:37:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1623, 'line4_down', 'sunday', '17:53:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1624, 'line4_down', 'sunday', '18:02:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1625, 'line4_down', 'sunday', '18:12:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1626, 'line4_down', 'sunday', '18:22:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1627, 'line4_down', 'sunday', '18:27:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1628, 'line4_down', 'sunday', '18:37:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1629, 'line4_down', 'sunday', '18:47:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1630, 'line4_down', 'sunday', '18:52:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1631, 'line4_down', 'sunday', '19:02:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1632, 'line4_down', 'sunday', '19:12:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1633, 'line4_down', 'sunday', '19:17:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1634, 'line4_down', 'sunday', '19:28:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1635, 'line4_down', 'sunday', '19:40:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1636, 'line4_down', 'sunday', '19:52:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1637, 'line4_down', 'sunday', '19:59:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1638, 'line4_down', 'sunday', '20:10:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1639, 'line4_down', 'sunday', '20:21:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1640, 'line4_down', 'sunday', '20:31:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1641, 'line4_down', 'sunday', '20:36:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1642, 'line4_down', 'sunday', '20:46:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1643, 'line4_down', 'sunday', '20:58:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1644, 'line4_down', 'sunday', '21:10:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1645, 'line4_down', 'sunday', '21:20:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1646, 'line4_down', 'sunday', '21:35:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1647, 'line4_down', 'sunday', '21:45:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1648, 'line4_down', 'sunday', '21:50:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1649, 'line4_down', 'sunday', '22:00:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1650, 'line4_down', 'sunday', '22:05:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1651, 'line4_down', 'sunday', '22:16:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1652, 'line4_down', 'sunday', '22:28:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1653, 'line4_down', 'sunday', '22:40:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1654, 'line4_down', 'sunday', '22:52:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1655, 'line4_down', 'sunday', '23:04:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1656, 'line4_down', 'sunday', '23:16:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1657, 'line4_down', 'sunday', '23:28:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, updated_at) VALUES (1658, 'line4_down', 'sunday', '23:45:30', '오이도', '2026-04-20 11:25:33.659474+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2142, 'choji_dn', 'saturday', '00:08:30', '원시', 'K7161', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2143, 'choji_dn', 'saturday', '05:57:30', '원시', 'K7201', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2144, 'choji_dn', 'saturday', '06:12:30', '원시', 'K7101', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2145, 'choji_dn', 'saturday', '06:26:30', '원시', 'K7103', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2146, 'choji_dn', 'saturday', '06:41:30', '원시', 'K7203', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2147, 'choji_dn', 'saturday', '06:56:30', '원시', 'K7205', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2148, 'choji_dn', 'saturday', '07:12:30', '원시', 'K7207', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2149, 'choji_dn', 'saturday', '07:28:30', '원시', 'K7105', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2150, 'choji_dn', 'saturday', '07:42:30', '원시', 'K7209', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2151, 'choji_dn', 'saturday', '07:59:30', '원시', 'K7211', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2152, 'choji_dn', 'saturday', '08:15:30', '원시', 'K7213', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2153, 'choji_dn', 'saturday', '08:29:30', '원시', 'K7107', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2154, 'choji_dn', 'saturday', '08:44:30', '원시', 'K7215', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2155, 'choji_dn', 'saturday', '09:00:30', '원시', 'K7109', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2156, 'choji_dn', 'saturday', '09:21:30', '원시', 'K7217', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2157, 'choji_dn', 'saturday', '09:41:30', '원시', 'K7111', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2158, 'choji_dn', 'saturday', '09:53:30', '원시', 'K7219', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2159, 'choji_dn', 'saturday', '10:04:30', '원시', 'K7113', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2160, 'choji_dn', 'saturday', '10:15:30', '원시', 'K7221', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2161, 'choji_dn', 'saturday', '10:30:30', '원시', 'K7223', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2162, 'choji_dn', 'saturday', '10:45:30', '원시', 'K7115', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2163, 'choji_dn', 'saturday', '10:59:30', '원시', 'K7225', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2164, 'choji_dn', 'saturday', '11:13:30', '원시', 'K7117', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2165, 'choji_dn', 'saturday', '11:27:30', '원시', 'K7227', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2166, 'choji_dn', 'saturday', '11:42:30', '원시', 'K7229', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2167, 'choji_dn', 'saturday', '11:59:30', '원시', 'K7231', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2168, 'choji_dn', 'saturday', '12:13:30', '원시', 'K7119', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2169, 'choji_dn', 'saturday', '12:29:30', '원시', 'K7233', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2170, 'choji_dn', 'saturday', '12:44:30', '원시', 'K7121', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2171, 'choji_dn', 'saturday', '12:59:30', '원시', 'K7235', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2172, 'choji_dn', 'saturday', '13:12:30', '원시', 'K7123', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2173, 'choji_dn', 'saturday', '13:28:30', '원시', 'K7237', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2174, 'choji_dn', 'saturday', '13:43:30', '원시', 'K7239', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2175, 'choji_dn', 'saturday', '13:58:30', '원시', 'K7125', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2176, 'choji_dn', 'saturday', '14:14:30', '원시', 'K7241', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2177, 'choji_dn', 'saturday', '14:29:30', '원시', 'K7127', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2178, 'choji_dn', 'saturday', '14:44:30', '원시', 'K7243', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2179, 'choji_dn', 'saturday', '14:59:30', '원시', 'K7129', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2180, 'choji_dn', 'saturday', '15:12:30', '원시', 'K7245', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2181, 'choji_dn', 'saturday', '15:26:30', '원시', 'K7131', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2182, 'choji_dn', 'saturday', '15:41:30', '원시', 'K7247', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2183, 'choji_dn', 'saturday', '15:56:30', '원시', 'K7133', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2184, 'choji_dn', 'saturday', '16:13:30', '원시', 'K7249', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2185, 'choji_dn', 'saturday', '16:27:30', '원시', 'K7135', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2186, 'choji_dn', 'saturday', '16:44:30', '원시', 'K7251', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2187, 'choji_dn', 'saturday', '16:59:30', '원시', 'K7137', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2188, 'choji_dn', 'saturday', '17:13:30', '원시', 'K7253', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2189, 'choji_dn', 'saturday', '17:28:30', '원시', 'K7139', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2190, 'choji_dn', 'saturday', '17:43:30', '원시', 'K7255', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2191, 'choji_dn', 'saturday', '17:58:30', '원시', 'K7141', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2192, 'choji_dn', 'saturday', '18:14:30', '원시', 'K7257', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2193, 'choji_dn', 'saturday', '18:27:30', '원시', 'K7143', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2194, 'choji_dn', 'saturday', '18:41:30', '원시', 'K7259', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2195, 'choji_dn', 'saturday', '18:55:30', '원시', 'K7145', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2196, 'choji_dn', 'saturday', '19:13:30', '원시', 'K7261', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2197, 'choji_dn', 'saturday', '19:30:30', '원시', 'K7147', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2198, 'choji_dn', 'saturday', '19:43:30', '원시', 'K7263', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2199, 'choji_dn', 'saturday', '19:57:30', '원시', 'K7149', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2200, 'choji_dn', 'saturday', '20:13:30', '원시', 'K7265', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2201, 'choji_dn', 'saturday', '20:25:30', '원시', 'K7267', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2202, 'choji_dn', 'saturday', '20:40:30', '원시', 'K7151', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2203, 'choji_dn', 'saturday', '20:55:30', '원시', 'K7269', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2204, 'choji_dn', 'saturday', '21:11:30', '원시', 'K7271', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2205, 'choji_dn', 'saturday', '21:26:30', '원시', 'K7153', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2206, 'choji_dn', 'saturday', '21:44:30', '원시', 'K7273', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2207, 'choji_dn', 'saturday', '22:02:30', '원시', 'K7155', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2208, 'choji_dn', 'saturday', '22:15:30', '원시', 'K7275', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2209, 'choji_dn', 'saturday', '22:29:30', '원시', 'K7157', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2210, 'choji_dn', 'saturday', '22:42:30', '원시', 'K7277', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2211, 'choji_dn', 'saturday', '22:58:30', '원시', 'K7279', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2212, 'choji_dn', 'saturday', '23:13:30', '원시', 'K7159', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2213, 'choji_dn', 'saturday', '23:27:30', '원시', 'K7281', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2214, 'choji_dn', 'saturday', '23:42:30', '원시', 'K7283', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2215, 'choji_dn', 'saturday', '23:57:30', '원시', 'K7285', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2216, 'choji_up', 'saturday', '05:11:00', '일산', 'K7102', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2217, 'choji_up', 'saturday', '05:20:00', '대곡', 'K7202', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2218, 'choji_up', 'saturday', '05:33:00', '대곡', 'K7204', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2219, 'choji_up', 'saturday', '05:46:00', '일산', 'K7104', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2220, 'choji_up', 'saturday', '06:03:00', '대곡', 'K7206', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2221, 'choji_up', 'saturday', '06:19:00', '대곡', 'K7208', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2222, 'choji_up', 'saturday', '06:35:00', '일산', 'K7106', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2223, 'choji_up', 'saturday', '06:51:00', '대곡', 'K7210', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2224, 'choji_up', 'saturday', '07:08:00', '일산', 'K7108', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2225, 'choji_up', 'saturday', '07:24:00', '대곡', 'K7212', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2226, 'choji_up', 'saturday', '07:39:00', '일산', 'K7110', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2227, 'choji_up', 'saturday', '07:53:00', '대곡', 'K7214', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2228, 'choji_up', 'saturday', '08:08:00', '일산', 'K7112', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2229, 'choji_up', 'saturday', '08:21:00', '대곡', 'K7216', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2230, 'choji_up', 'saturday', '08:36:00', '대곡', 'K7218', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2231, 'choji_up', 'saturday', '08:52:00', '일산', 'K7114', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2232, 'choji_up', 'saturday', '09:06:00', '대곡', 'K7220', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2233, 'choji_up', 'saturday', '09:22:00', '대곡', 'K7222', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2234, 'choji_up', 'saturday', '09:36:00', '대곡', 'K7224', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2235, 'choji_up', 'saturday', '09:51:00', '일산', 'K7116', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2236, 'choji_up', 'saturday', '10:06:00', '대곡', 'K7226', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2237, 'choji_up', 'saturday', '10:21:00', '일산', 'K7118', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2238, 'choji_up', 'saturday', '10:36:00', '대곡', 'K7228', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2239, 'choji_up', 'saturday', '10:52:00', '일산', 'K7120', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2240, 'choji_up', 'saturday', '11:06:00', '대곡', 'K7230', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2241, 'choji_up', 'saturday', '11:21:00', '일산', 'K7122', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2242, 'choji_up', 'saturday', '11:35:00', '대곡', 'K7232', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2243, 'choji_up', 'saturday', '11:50:00', '대곡', 'K7234', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2244, 'choji_up', 'saturday', '12:06:00', '일산', 'K7124', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2245, 'choji_up', 'saturday', '12:21:00', '대곡', 'K7236', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2246, 'choji_up', 'saturday', '12:38:00', '일산', 'K7126', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2247, 'choji_up', 'saturday', '12:52:00', '대곡', 'K7238', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2248, 'choji_up', 'saturday', '13:07:00', '일산', 'K7128', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2249, 'choji_up', 'saturday', '13:20:00', '대곡', 'K7240', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2250, 'choji_up', 'saturday', '13:34:00', '일산', 'K7130', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2251, 'choji_up', 'saturday', '13:49:00', '대곡', 'K7242', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2252, 'choji_up', 'saturday', '14:05:00', '일산', 'K7132', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2253, 'choji_up', 'saturday', '14:20:00', '대곡', 'K7244', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2254, 'choji_up', 'saturday', '14:36:00', '일산', 'K7134', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2255, 'choji_up', 'saturday', '14:51:00', '대곡', 'K7246', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2256, 'choji_up', 'saturday', '15:06:00', '일산', 'K7136', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2257, 'choji_up', 'saturday', '15:21:00', '대곡', 'K7248', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2258, 'choji_up', 'saturday', '15:36:00', '일산', 'K7138', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2259, 'choji_up', 'saturday', '15:51:00', '대곡', 'K7250', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2260, 'choji_up', 'saturday', '16:08:00', '일산', 'K7140', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2261, 'choji_up', 'saturday', '16:21:00', '대곡', 'K7252', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2262, 'choji_up', 'saturday', '16:37:00', '일산', 'K7142', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2263, 'choji_up', 'saturday', '16:48:00', '대곡', 'K7254', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2264, 'choji_up', 'saturday', '17:01:00', '일산', 'K7144', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2265, 'choji_up', 'saturday', '17:20:00', '대곡', 'K7256', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2266, 'choji_up', 'saturday', '17:34:00', '일산', 'K7146', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2267, 'choji_up', 'saturday', '17:50:00', '대곡', 'K7258', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2268, 'choji_up', 'saturday', '18:06:00', '대곡', 'K7260', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2269, 'choji_up', 'saturday', '18:21:00', '일산', 'K7148', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2270, 'choji_up', 'saturday', '18:32:00', '대곡', 'K7262', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2271, 'choji_up', 'saturday', '18:50:00', '일산', 'K7150', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2272, 'choji_up', 'saturday', '19:02:00', '대곡', 'K7264', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2273, 'choji_up', 'saturday', '19:18:00', '대곡', 'K7266', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2274, 'choji_up', 'saturday', '19:37:00', '일산', 'K7152', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2275, 'choji_up', 'saturday', '19:51:00', '대곡', 'K7268', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2276, 'choji_up', 'saturday', '20:05:00', '일산', 'K7154', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2277, 'choji_up', 'saturday', '20:21:00', '대곡', 'K7270', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2278, 'choji_up', 'saturday', '20:36:00', '일산', 'K7156', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2279, 'choji_up', 'saturday', '20:47:00', '대곡', 'K7272', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2280, 'choji_up', 'saturday', '21:03:00', '대곡', 'K7274', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2281, 'choji_up', 'saturday', '21:18:00', '대곡', 'K7276', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2282, 'choji_up', 'saturday', '21:34:00', '대곡', 'K7278', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2283, 'choji_up', 'saturday', '21:49:00', '일산', 'K7158', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2284, 'choji_up', 'saturday', '22:04:00', '대곡', 'K7280', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2285, 'choji_up', 'saturday', '22:24:00', '일산', 'K7160', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2286, 'choji_up', 'saturday', '22:40:00', '대곡', 'K7282', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2287, 'choji_up', 'saturday', '22:55:00', '대곡', 'K7284', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2288, 'choji_up', 'saturday', '23:10:00', '일산', 'K7162', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2289, 'choji_up', 'saturday', '23:35:00', '대곡', 'K7286', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2290, 'siheung_dn', 'saturday', '05:45:00', '원시', 'K7201', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2291, 'siheung_dn', 'saturday', '06:00:00', '원시', 'K7101', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2292, 'siheung_dn', 'saturday', '06:14:00', '원시', 'K7103', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2293, 'siheung_dn', 'saturday', '06:29:00', '원시', 'K7203', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2294, 'siheung_dn', 'saturday', '06:44:00', '원시', 'K7205', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2295, 'siheung_dn', 'saturday', '07:00:00', '원시', 'K7207', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2296, 'siheung_dn', 'saturday', '07:16:00', '원시', 'K7105', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2297, 'siheung_dn', 'saturday', '07:30:00', '원시', 'K7209', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2298, 'siheung_dn', 'saturday', '07:47:00', '원시', 'K7211', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2299, 'siheung_dn', 'saturday', '08:03:00', '원시', 'K7213', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2300, 'siheung_dn', 'saturday', '08:17:00', '원시', 'K7107', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2301, 'siheung_dn', 'saturday', '08:32:00', '원시', 'K7215', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2302, 'siheung_dn', 'saturday', '08:48:00', '원시', 'K7109', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2303, 'siheung_dn', 'saturday', '09:09:00', '원시', 'K7217', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2304, 'siheung_dn', 'saturday', '09:29:00', '원시', 'K7111', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2305, 'siheung_dn', 'saturday', '09:41:00', '원시', 'K7219', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2306, 'siheung_dn', 'saturday', '09:52:00', '원시', 'K7113', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2307, 'siheung_dn', 'saturday', '10:03:00', '원시', 'K7221', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2308, 'siheung_dn', 'saturday', '10:18:00', '원시', 'K7223', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2309, 'siheung_dn', 'saturday', '10:33:00', '원시', 'K7115', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2310, 'siheung_dn', 'saturday', '10:47:00', '원시', 'K7225', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2311, 'siheung_dn', 'saturday', '11:01:00', '원시', 'K7117', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2312, 'siheung_dn', 'saturday', '11:15:00', '원시', 'K7227', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2313, 'siheung_dn', 'saturday', '11:30:00', '원시', 'K7229', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2314, 'siheung_dn', 'saturday', '11:47:00', '원시', 'K7231', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2315, 'siheung_dn', 'saturday', '12:01:00', '원시', 'K7119', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2316, 'siheung_dn', 'saturday', '12:17:00', '원시', 'K7233', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2317, 'siheung_dn', 'saturday', '12:32:00', '원시', 'K7121', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2318, 'siheung_dn', 'saturday', '12:47:00', '원시', 'K7235', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2319, 'siheung_dn', 'saturday', '13:00:00', '원시', 'K7123', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2320, 'siheung_dn', 'saturday', '13:16:00', '원시', 'K7237', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2321, 'siheung_dn', 'saturday', '13:31:00', '원시', 'K7239', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2322, 'siheung_dn', 'saturday', '13:46:00', '원시', 'K7125', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2323, 'siheung_dn', 'saturday', '14:02:00', '원시', 'K7241', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2324, 'siheung_dn', 'saturday', '14:17:00', '원시', 'K7127', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2325, 'siheung_dn', 'saturday', '14:32:00', '원시', 'K7243', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2326, 'siheung_dn', 'saturday', '14:47:00', '원시', 'K7129', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2327, 'siheung_dn', 'saturday', '15:00:00', '원시', 'K7245', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2328, 'siheung_dn', 'saturday', '15:14:00', '원시', 'K7131', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2329, 'siheung_dn', 'saturday', '15:29:00', '원시', 'K7247', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2330, 'siheung_dn', 'saturday', '15:44:00', '원시', 'K7133', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2331, 'siheung_dn', 'saturday', '16:01:00', '원시', 'K7249', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2332, 'siheung_dn', 'saturday', '16:15:00', '원시', 'K7135', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2333, 'siheung_dn', 'saturday', '16:32:00', '원시', 'K7251', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2334, 'siheung_dn', 'saturday', '16:47:00', '원시', 'K7137', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2335, 'siheung_dn', 'saturday', '17:01:00', '원시', 'K7253', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2336, 'siheung_dn', 'saturday', '17:16:00', '원시', 'K7139', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2337, 'siheung_dn', 'saturday', '17:31:00', '원시', 'K7255', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2338, 'siheung_dn', 'saturday', '17:46:00', '원시', 'K7141', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2339, 'siheung_dn', 'saturday', '18:02:00', '원시', 'K7257', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2340, 'siheung_dn', 'saturday', '18:15:00', '원시', 'K7143', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2341, 'siheung_dn', 'saturday', '18:29:00', '원시', 'K7259', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2342, 'siheung_dn', 'saturday', '18:43:00', '원시', 'K7145', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2343, 'siheung_dn', 'saturday', '19:01:00', '원시', 'K7261', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2344, 'siheung_dn', 'saturday', '19:18:00', '원시', 'K7147', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2345, 'siheung_dn', 'saturday', '19:31:00', '원시', 'K7263', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2346, 'siheung_dn', 'saturday', '19:45:00', '원시', 'K7149', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2347, 'siheung_dn', 'saturday', '20:01:00', '원시', 'K7265', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2348, 'siheung_dn', 'saturday', '20:13:00', '원시', 'K7267', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2349, 'siheung_dn', 'saturday', '20:28:00', '원시', 'K7151', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2350, 'siheung_dn', 'saturday', '20:43:00', '원시', 'K7269', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2351, 'siheung_dn', 'saturday', '20:59:00', '원시', 'K7271', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2352, 'siheung_dn', 'saturday', '21:14:00', '원시', 'K7153', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2353, 'siheung_dn', 'saturday', '21:32:00', '원시', 'K7273', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2354, 'siheung_dn', 'saturday', '21:50:00', '원시', 'K7155', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2355, 'siheung_dn', 'saturday', '22:03:00', '원시', 'K7275', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2356, 'siheung_dn', 'saturday', '22:17:00', '원시', 'K7157', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2357, 'siheung_dn', 'saturday', '22:30:00', '원시', 'K7277', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2358, 'siheung_dn', 'saturday', '22:46:00', '원시', 'K7279', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2359, 'siheung_dn', 'saturday', '23:01:00', '원시', 'K7159', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2360, 'siheung_dn', 'saturday', '23:15:00', '원시', 'K7281', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2361, 'siheung_dn', 'saturday', '23:30:00', '원시', 'K7283', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2362, 'siheung_dn', 'saturday', '23:45:00', '원시', 'K7285', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2363, 'siheung_dn', 'saturday', '23:56:00', '원시', 'K7161', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2364, 'siheung_up', 'saturday', '05:23:00', '일산', 'K7102', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2365, 'siheung_up', 'saturday', '05:32:00', '대곡', 'K7202', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2366, 'siheung_up', 'saturday', '05:45:00', '대곡', 'K7204', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2367, 'siheung_up', 'saturday', '05:58:00', '일산', 'K7104', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2368, 'siheung_up', 'saturday', '06:15:00', '대곡', 'K7206', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2369, 'siheung_up', 'saturday', '06:31:00', '대곡', 'K7208', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2370, 'siheung_up', 'saturday', '06:47:00', '일산', 'K7106', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2371, 'siheung_up', 'saturday', '07:03:00', '대곡', 'K7210', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2372, 'siheung_up', 'saturday', '07:20:00', '일산', 'K7108', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2373, 'siheung_up', 'saturday', '07:36:00', '대곡', 'K7212', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2374, 'siheung_up', 'saturday', '07:51:00', '일산', 'K7110', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2375, 'siheung_up', 'saturday', '08:05:00', '대곡', 'K7214', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2376, 'siheung_up', 'saturday', '08:20:00', '일산', 'K7112', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2377, 'siheung_up', 'saturday', '08:33:00', '대곡', 'K7216', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2378, 'siheung_up', 'saturday', '08:48:00', '대곡', 'K7218', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2379, 'siheung_up', 'saturday', '09:04:00', '일산', 'K7114', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2380, 'siheung_up', 'saturday', '09:18:00', '대곡', 'K7220', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2381, 'siheung_up', 'saturday', '09:34:00', '대곡', 'K7222', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2382, 'siheung_up', 'saturday', '09:48:00', '대곡', 'K7224', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2383, 'siheung_up', 'saturday', '10:03:00', '일산', 'K7116', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2384, 'siheung_up', 'saturday', '10:18:00', '대곡', 'K7226', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2385, 'siheung_up', 'saturday', '10:33:00', '일산', 'K7118', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2386, 'siheung_up', 'saturday', '10:48:00', '대곡', 'K7228', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2387, 'siheung_up', 'saturday', '11:04:00', '일산', 'K7120', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2388, 'siheung_up', 'saturday', '11:18:00', '대곡', 'K7230', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2389, 'siheung_up', 'saturday', '11:33:00', '일산', 'K7122', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2390, 'siheung_up', 'saturday', '11:47:00', '대곡', 'K7232', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2391, 'siheung_up', 'saturday', '12:02:00', '대곡', 'K7234', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2392, 'siheung_up', 'saturday', '12:18:00', '일산', 'K7124', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2393, 'siheung_up', 'saturday', '12:33:00', '대곡', 'K7236', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2394, 'siheung_up', 'saturday', '12:50:00', '일산', 'K7126', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2395, 'siheung_up', 'saturday', '13:04:00', '대곡', 'K7238', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2396, 'siheung_up', 'saturday', '13:19:00', '일산', 'K7128', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2397, 'siheung_up', 'saturday', '13:32:00', '대곡', 'K7240', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2398, 'siheung_up', 'saturday', '13:46:00', '일산', 'K7130', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2399, 'siheung_up', 'saturday', '14:01:00', '대곡', 'K7242', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2400, 'siheung_up', 'saturday', '14:17:00', '일산', 'K7132', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2401, 'siheung_up', 'saturday', '14:32:00', '대곡', 'K7244', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2402, 'siheung_up', 'saturday', '14:48:00', '일산', 'K7134', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2403, 'siheung_up', 'saturday', '15:03:00', '대곡', 'K7246', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2404, 'siheung_up', 'saturday', '15:18:00', '일산', 'K7136', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2405, 'siheung_up', 'saturday', '15:33:00', '대곡', 'K7248', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2406, 'siheung_up', 'saturday', '15:48:00', '일산', 'K7138', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2407, 'siheung_up', 'saturday', '16:03:00', '대곡', 'K7250', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2408, 'siheung_up', 'saturday', '16:20:00', '일산', 'K7140', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2409, 'siheung_up', 'saturday', '16:33:00', '대곡', 'K7252', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2410, 'siheung_up', 'saturday', '16:49:00', '일산', 'K7142', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2411, 'siheung_up', 'saturday', '17:00:00', '대곡', 'K7254', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2412, 'siheung_up', 'saturday', '17:13:00', '일산', 'K7144', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2413, 'siheung_up', 'saturday', '17:32:00', '대곡', 'K7256', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2414, 'siheung_up', 'saturday', '17:46:00', '일산', 'K7146', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2415, 'siheung_up', 'saturday', '18:02:00', '대곡', 'K7258', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2416, 'siheung_up', 'saturday', '18:18:00', '대곡', 'K7260', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2417, 'siheung_up', 'saturday', '18:33:00', '일산', 'K7148', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2418, 'siheung_up', 'saturday', '18:44:00', '대곡', 'K7262', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2419, 'siheung_up', 'saturday', '19:02:00', '일산', 'K7150', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2420, 'siheung_up', 'saturday', '19:14:00', '대곡', 'K7264', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2421, 'siheung_up', 'saturday', '19:30:00', '대곡', 'K7266', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2422, 'siheung_up', 'saturday', '19:49:00', '일산', 'K7152', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2423, 'siheung_up', 'saturday', '20:03:00', '대곡', 'K7268', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2424, 'siheung_up', 'saturday', '20:17:00', '일산', 'K7154', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2425, 'siheung_up', 'saturday', '20:33:00', '대곡', 'K7270', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2426, 'siheung_up', 'saturday', '20:48:00', '일산', 'K7156', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2427, 'siheung_up', 'saturday', '20:59:00', '대곡', 'K7272', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2428, 'siheung_up', 'saturday', '21:15:00', '대곡', 'K7274', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2429, 'siheung_up', 'saturday', '21:30:00', '대곡', 'K7276', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2430, 'siheung_up', 'saturday', '21:46:00', '대곡', 'K7278', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2431, 'siheung_up', 'saturday', '22:01:00', '일산', 'K7158', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2432, 'siheung_up', 'saturday', '22:16:00', '대곡', 'K7280', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2433, 'siheung_up', 'saturday', '22:36:00', '일산', 'K7160', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2434, 'siheung_up', 'saturday', '22:52:00', '대곡', 'K7282', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2435, 'siheung_up', 'saturday', '23:07:00', '대곡', 'K7284', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2436, 'siheung_up', 'saturday', '23:22:00', '일산', 'K7162', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2437, 'siheung_up', 'saturday', '23:47:00', '대곡', 'K7286', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2438, 'choji_dn', 'sunday', '00:08:30', '원시', 'K7161', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2439, 'choji_dn', 'sunday', '05:57:30', '원시', 'K7201', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2440, 'choji_dn', 'sunday', '06:12:30', '원시', 'K7101', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2441, 'choji_dn', 'sunday', '06:26:30', '원시', 'K7103', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2442, 'choji_dn', 'sunday', '06:41:30', '원시', 'K7203', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2443, 'choji_dn', 'sunday', '06:56:30', '원시', 'K7205', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2444, 'choji_dn', 'sunday', '07:12:30', '원시', 'K7207', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2445, 'choji_dn', 'sunday', '07:28:30', '원시', 'K7105', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2446, 'choji_dn', 'sunday', '07:42:30', '원시', 'K7209', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2447, 'choji_dn', 'sunday', '07:59:30', '원시', 'K7211', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2448, 'choji_dn', 'sunday', '08:15:30', '원시', 'K7213', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2449, 'choji_dn', 'sunday', '08:29:30', '원시', 'K7107', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2450, 'choji_dn', 'sunday', '08:44:30', '원시', 'K7215', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2451, 'choji_dn', 'sunday', '09:00:30', '원시', 'K7109', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2452, 'choji_dn', 'sunday', '09:21:30', '원시', 'K7217', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2453, 'choji_dn', 'sunday', '09:41:30', '원시', 'K7111', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2454, 'choji_dn', 'sunday', '09:53:30', '원시', 'K7219', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2455, 'choji_dn', 'sunday', '10:04:30', '원시', 'K7113', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2456, 'choji_dn', 'sunday', '10:15:30', '원시', 'K7221', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2457, 'choji_dn', 'sunday', '10:30:30', '원시', 'K7223', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2458, 'choji_dn', 'sunday', '10:45:30', '원시', 'K7115', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2459, 'choji_dn', 'sunday', '10:59:30', '원시', 'K7225', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2460, 'choji_dn', 'sunday', '11:13:30', '원시', 'K7117', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2461, 'choji_dn', 'sunday', '11:27:30', '원시', 'K7227', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2462, 'choji_dn', 'sunday', '11:42:30', '원시', 'K7229', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2463, 'choji_dn', 'sunday', '11:59:30', '원시', 'K7231', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2464, 'choji_dn', 'sunday', '12:13:30', '원시', 'K7119', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2465, 'choji_dn', 'sunday', '12:29:30', '원시', 'K7233', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2466, 'choji_dn', 'sunday', '12:44:30', '원시', 'K7121', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2467, 'choji_dn', 'sunday', '12:59:30', '원시', 'K7235', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2468, 'choji_dn', 'sunday', '13:12:30', '원시', 'K7123', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2469, 'choji_dn', 'sunday', '13:28:30', '원시', 'K7237', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2470, 'choji_dn', 'sunday', '13:43:30', '원시', 'K7239', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2471, 'choji_dn', 'sunday', '13:58:30', '원시', 'K7125', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2472, 'choji_dn', 'sunday', '14:14:30', '원시', 'K7241', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2473, 'choji_dn', 'sunday', '14:29:30', '원시', 'K7127', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2474, 'choji_dn', 'sunday', '14:44:30', '원시', 'K7243', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2475, 'choji_dn', 'sunday', '14:59:30', '원시', 'K7129', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2476, 'choji_dn', 'sunday', '15:12:30', '원시', 'K7245', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2477, 'choji_dn', 'sunday', '15:26:30', '원시', 'K7131', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2478, 'choji_dn', 'sunday', '15:41:30', '원시', 'K7247', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2479, 'choji_dn', 'sunday', '15:56:30', '원시', 'K7133', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2480, 'choji_dn', 'sunday', '16:13:30', '원시', 'K7249', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2481, 'choji_dn', 'sunday', '16:27:30', '원시', 'K7135', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2482, 'choji_dn', 'sunday', '16:44:30', '원시', 'K7251', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2483, 'choji_dn', 'sunday', '16:59:30', '원시', 'K7137', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2484, 'choji_dn', 'sunday', '17:13:30', '원시', 'K7253', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2485, 'choji_dn', 'sunday', '17:28:30', '원시', 'K7139', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2486, 'choji_dn', 'sunday', '17:43:30', '원시', 'K7255', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2487, 'choji_dn', 'sunday', '17:58:30', '원시', 'K7141', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2488, 'choji_dn', 'sunday', '18:14:30', '원시', 'K7257', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2489, 'choji_dn', 'sunday', '18:27:30', '원시', 'K7143', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2490, 'choji_dn', 'sunday', '18:41:30', '원시', 'K7259', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2491, 'choji_dn', 'sunday', '18:55:30', '원시', 'K7145', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2492, 'choji_dn', 'sunday', '19:13:30', '원시', 'K7261', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2493, 'choji_dn', 'sunday', '19:30:30', '원시', 'K7147', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2494, 'choji_dn', 'sunday', '19:43:30', '원시', 'K7263', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2495, 'choji_dn', 'sunday', '19:57:30', '원시', 'K7149', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2496, 'choji_dn', 'sunday', '20:13:30', '원시', 'K7265', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2497, 'choji_dn', 'sunday', '20:25:30', '원시', 'K7267', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2498, 'choji_dn', 'sunday', '20:40:30', '원시', 'K7151', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2499, 'choji_dn', 'sunday', '20:55:30', '원시', 'K7269', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2500, 'choji_dn', 'sunday', '21:11:30', '원시', 'K7271', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2501, 'choji_dn', 'sunday', '21:26:30', '원시', 'K7153', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2502, 'choji_dn', 'sunday', '21:44:30', '원시', 'K7273', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2503, 'choji_dn', 'sunday', '22:02:30', '원시', 'K7155', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2504, 'choji_dn', 'sunday', '22:15:30', '원시', 'K7275', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2505, 'choji_dn', 'sunday', '22:29:30', '원시', 'K7157', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2506, 'choji_dn', 'sunday', '22:42:30', '원시', 'K7277', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2507, 'choji_dn', 'sunday', '22:58:30', '원시', 'K7279', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2508, 'choji_dn', 'sunday', '23:13:30', '원시', 'K7159', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2509, 'choji_dn', 'sunday', '23:27:30', '원시', 'K7281', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2510, 'choji_dn', 'sunday', '23:42:30', '원시', 'K7283', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2511, 'choji_dn', 'sunday', '23:57:30', '원시', 'K7285', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2512, 'choji_up', 'sunday', '05:11:00', '일산', 'K7102', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2513, 'choji_up', 'sunday', '05:20:00', '대곡', 'K7202', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2514, 'choji_up', 'sunday', '05:33:00', '대곡', 'K7204', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2515, 'choji_up', 'sunday', '05:46:00', '일산', 'K7104', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2516, 'choji_up', 'sunday', '06:03:00', '대곡', 'K7206', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2517, 'choji_up', 'sunday', '06:19:00', '대곡', 'K7208', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2518, 'choji_up', 'sunday', '06:35:00', '일산', 'K7106', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2519, 'choji_up', 'sunday', '06:51:00', '대곡', 'K7210', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2520, 'choji_up', 'sunday', '07:08:00', '일산', 'K7108', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2521, 'choji_up', 'sunday', '07:24:00', '대곡', 'K7212', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2522, 'choji_up', 'sunday', '07:39:00', '일산', 'K7110', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2523, 'choji_up', 'sunday', '07:53:00', '대곡', 'K7214', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2524, 'choji_up', 'sunday', '08:08:00', '일산', 'K7112', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2525, 'choji_up', 'sunday', '08:21:00', '대곡', 'K7216', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2526, 'choji_up', 'sunday', '08:36:00', '대곡', 'K7218', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2527, 'choji_up', 'sunday', '08:52:00', '일산', 'K7114', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2528, 'choji_up', 'sunday', '09:06:00', '대곡', 'K7220', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2529, 'choji_up', 'sunday', '09:22:00', '대곡', 'K7222', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2530, 'choji_up', 'sunday', '09:36:00', '대곡', 'K7224', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2531, 'choji_up', 'sunday', '09:51:00', '일산', 'K7116', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2532, 'choji_up', 'sunday', '10:06:00', '대곡', 'K7226', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2533, 'choji_up', 'sunday', '10:21:00', '일산', 'K7118', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2534, 'choji_up', 'sunday', '10:36:00', '대곡', 'K7228', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2535, 'choji_up', 'sunday', '10:52:00', '일산', 'K7120', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2536, 'choji_up', 'sunday', '11:06:00', '대곡', 'K7230', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2537, 'choji_up', 'sunday', '11:21:00', '일산', 'K7122', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2538, 'choji_up', 'sunday', '11:35:00', '대곡', 'K7232', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2539, 'choji_up', 'sunday', '11:50:00', '대곡', 'K7234', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2540, 'choji_up', 'sunday', '12:06:00', '일산', 'K7124', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2541, 'choji_up', 'sunday', '12:21:00', '대곡', 'K7236', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2542, 'choji_up', 'sunday', '12:38:00', '일산', 'K7126', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2543, 'choji_up', 'sunday', '12:52:00', '대곡', 'K7238', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2544, 'choji_up', 'sunday', '13:07:00', '일산', 'K7128', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2545, 'choji_up', 'sunday', '13:20:00', '대곡', 'K7240', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2546, 'choji_up', 'sunday', '13:34:00', '일산', 'K7130', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2547, 'choji_up', 'sunday', '13:49:00', '대곡', 'K7242', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2548, 'choji_up', 'sunday', '14:05:00', '일산', 'K7132', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2549, 'choji_up', 'sunday', '14:20:00', '대곡', 'K7244', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2550, 'choji_up', 'sunday', '14:36:00', '일산', 'K7134', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2551, 'choji_up', 'sunday', '14:51:00', '대곡', 'K7246', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2552, 'choji_up', 'sunday', '15:06:00', '일산', 'K7136', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2553, 'choji_up', 'sunday', '15:21:00', '대곡', 'K7248', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2554, 'choji_up', 'sunday', '15:36:00', '일산', 'K7138', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2555, 'choji_up', 'sunday', '15:51:00', '대곡', 'K7250', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2556, 'choji_up', 'sunday', '16:08:00', '일산', 'K7140', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2557, 'choji_up', 'sunday', '16:21:00', '대곡', 'K7252', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2558, 'choji_up', 'sunday', '16:37:00', '일산', 'K7142', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2559, 'choji_up', 'sunday', '16:48:00', '대곡', 'K7254', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2560, 'choji_up', 'sunday', '17:01:00', '일산', 'K7144', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2561, 'choji_up', 'sunday', '17:20:00', '대곡', 'K7256', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2562, 'choji_up', 'sunday', '17:34:00', '일산', 'K7146', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2563, 'choji_up', 'sunday', '17:50:00', '대곡', 'K7258', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2564, 'choji_up', 'sunday', '18:06:00', '대곡', 'K7260', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2565, 'choji_up', 'sunday', '18:21:00', '일산', 'K7148', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2566, 'choji_up', 'sunday', '18:32:00', '대곡', 'K7262', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2567, 'choji_up', 'sunday', '18:50:00', '일산', 'K7150', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2568, 'choji_up', 'sunday', '19:02:00', '대곡', 'K7264', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2569, 'choji_up', 'sunday', '19:18:00', '대곡', 'K7266', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2570, 'choji_up', 'sunday', '19:37:00', '일산', 'K7152', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2571, 'choji_up', 'sunday', '19:51:00', '대곡', 'K7268', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2572, 'choji_up', 'sunday', '20:05:00', '일산', 'K7154', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2573, 'choji_up', 'sunday', '20:21:00', '대곡', 'K7270', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2574, 'choji_up', 'sunday', '20:36:00', '일산', 'K7156', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2575, 'choji_up', 'sunday', '20:47:00', '대곡', 'K7272', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2576, 'choji_up', 'sunday', '21:03:00', '대곡', 'K7274', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2577, 'choji_up', 'sunday', '21:18:00', '대곡', 'K7276', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2578, 'choji_up', 'sunday', '21:34:00', '대곡', 'K7278', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2579, 'choji_up', 'sunday', '21:49:00', '일산', 'K7158', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2580, 'choji_up', 'sunday', '22:04:00', '대곡', 'K7280', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2581, 'choji_up', 'sunday', '22:24:00', '일산', 'K7160', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2582, 'choji_up', 'sunday', '22:40:00', '대곡', 'K7282', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2583, 'choji_up', 'sunday', '22:55:00', '대곡', 'K7284', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2584, 'choji_up', 'sunday', '23:10:00', '일산', 'K7162', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2585, 'choji_up', 'sunday', '23:35:00', '대곡', 'K7286', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2586, 'siheung_dn', 'sunday', '05:45:00', '원시', 'K7201', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2587, 'siheung_dn', 'sunday', '06:00:00', '원시', 'K7101', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2588, 'siheung_dn', 'sunday', '06:14:00', '원시', 'K7103', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2589, 'siheung_dn', 'sunday', '06:29:00', '원시', 'K7203', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2590, 'siheung_dn', 'sunday', '06:44:00', '원시', 'K7205', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2591, 'siheung_dn', 'sunday', '07:00:00', '원시', 'K7207', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2592, 'siheung_dn', 'sunday', '07:16:00', '원시', 'K7105', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2593, 'siheung_dn', 'sunday', '07:30:00', '원시', 'K7209', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2594, 'siheung_dn', 'sunday', '07:47:00', '원시', 'K7211', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2595, 'siheung_dn', 'sunday', '08:03:00', '원시', 'K7213', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2596, 'siheung_dn', 'sunday', '08:17:00', '원시', 'K7107', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2597, 'siheung_dn', 'sunday', '08:32:00', '원시', 'K7215', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2598, 'siheung_dn', 'sunday', '08:48:00', '원시', 'K7109', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2599, 'siheung_dn', 'sunday', '09:09:00', '원시', 'K7217', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2600, 'siheung_dn', 'sunday', '09:29:00', '원시', 'K7111', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2601, 'siheung_dn', 'sunday', '09:41:00', '원시', 'K7219', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2602, 'siheung_dn', 'sunday', '09:52:00', '원시', 'K7113', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2603, 'siheung_dn', 'sunday', '10:03:00', '원시', 'K7221', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2604, 'siheung_dn', 'sunday', '10:18:00', '원시', 'K7223', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2605, 'siheung_dn', 'sunday', '10:33:00', '원시', 'K7115', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2606, 'siheung_dn', 'sunday', '10:47:00', '원시', 'K7225', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2607, 'siheung_dn', 'sunday', '11:01:00', '원시', 'K7117', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2608, 'siheung_dn', 'sunday', '11:15:00', '원시', 'K7227', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2609, 'siheung_dn', 'sunday', '11:30:00', '원시', 'K7229', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2610, 'siheung_dn', 'sunday', '11:47:00', '원시', 'K7231', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2611, 'siheung_dn', 'sunday', '12:01:00', '원시', 'K7119', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2612, 'siheung_dn', 'sunday', '12:17:00', '원시', 'K7233', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2613, 'siheung_dn', 'sunday', '12:32:00', '원시', 'K7121', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2614, 'siheung_dn', 'sunday', '12:47:00', '원시', 'K7235', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2615, 'siheung_dn', 'sunday', '13:00:00', '원시', 'K7123', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2616, 'siheung_dn', 'sunday', '13:16:00', '원시', 'K7237', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2617, 'siheung_dn', 'sunday', '13:31:00', '원시', 'K7239', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2618, 'siheung_dn', 'sunday', '13:46:00', '원시', 'K7125', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2619, 'siheung_dn', 'sunday', '14:02:00', '원시', 'K7241', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2620, 'siheung_dn', 'sunday', '14:17:00', '원시', 'K7127', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2621, 'siheung_dn', 'sunday', '14:32:00', '원시', 'K7243', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2622, 'siheung_dn', 'sunday', '14:47:00', '원시', 'K7129', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2623, 'siheung_dn', 'sunday', '15:00:00', '원시', 'K7245', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2624, 'siheung_dn', 'sunday', '15:14:00', '원시', 'K7131', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2625, 'siheung_dn', 'sunday', '15:29:00', '원시', 'K7247', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2626, 'siheung_dn', 'sunday', '15:44:00', '원시', 'K7133', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2627, 'siheung_dn', 'sunday', '16:01:00', '원시', 'K7249', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2628, 'siheung_dn', 'sunday', '16:15:00', '원시', 'K7135', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2629, 'siheung_dn', 'sunday', '16:32:00', '원시', 'K7251', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2630, 'siheung_dn', 'sunday', '16:47:00', '원시', 'K7137', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2631, 'siheung_dn', 'sunday', '17:01:00', '원시', 'K7253', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2632, 'siheung_dn', 'sunday', '17:16:00', '원시', 'K7139', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2633, 'siheung_dn', 'sunday', '17:31:00', '원시', 'K7255', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2634, 'siheung_dn', 'sunday', '17:46:00', '원시', 'K7141', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2635, 'siheung_dn', 'sunday', '18:02:00', '원시', 'K7257', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2636, 'siheung_dn', 'sunday', '18:15:00', '원시', 'K7143', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2637, 'siheung_dn', 'sunday', '18:29:00', '원시', 'K7259', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2638, 'siheung_dn', 'sunday', '18:43:00', '원시', 'K7145', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2639, 'siheung_dn', 'sunday', '19:01:00', '원시', 'K7261', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2640, 'siheung_dn', 'sunday', '19:18:00', '원시', 'K7147', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2641, 'siheung_dn', 'sunday', '19:31:00', '원시', 'K7263', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2642, 'siheung_dn', 'sunday', '19:45:00', '원시', 'K7149', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2643, 'siheung_dn', 'sunday', '20:01:00', '원시', 'K7265', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2644, 'siheung_dn', 'sunday', '20:13:00', '원시', 'K7267', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2645, 'siheung_dn', 'sunday', '20:28:00', '원시', 'K7151', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2646, 'siheung_dn', 'sunday', '20:43:00', '원시', 'K7269', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2647, 'siheung_dn', 'sunday', '20:59:00', '원시', 'K7271', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2648, 'siheung_dn', 'sunday', '21:14:00', '원시', 'K7153', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2649, 'siheung_dn', 'sunday', '21:32:00', '원시', 'K7273', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2650, 'siheung_dn', 'sunday', '21:50:00', '원시', 'K7155', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2651, 'siheung_dn', 'sunday', '22:03:00', '원시', 'K7275', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2652, 'siheung_dn', 'sunday', '22:17:00', '원시', 'K7157', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2653, 'siheung_dn', 'sunday', '22:30:00', '원시', 'K7277', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2654, 'siheung_dn', 'sunday', '22:46:00', '원시', 'K7279', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2655, 'siheung_dn', 'sunday', '23:01:00', '원시', 'K7159', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2656, 'siheung_dn', 'sunday', '23:15:00', '원시', 'K7281', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2657, 'siheung_dn', 'sunday', '23:30:00', '원시', 'K7283', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2658, 'siheung_dn', 'sunday', '23:45:00', '원시', 'K7285', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2659, 'siheung_dn', 'sunday', '23:56:00', '원시', 'K7161', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2660, 'siheung_up', 'sunday', '05:23:00', '일산', 'K7102', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2661, 'siheung_up', 'sunday', '05:32:00', '대곡', 'K7202', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2662, 'siheung_up', 'sunday', '05:45:00', '대곡', 'K7204', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2663, 'siheung_up', 'sunday', '05:58:00', '일산', 'K7104', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2664, 'siheung_up', 'sunday', '06:15:00', '대곡', 'K7206', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2665, 'siheung_up', 'sunday', '06:31:00', '대곡', 'K7208', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2666, 'siheung_up', 'sunday', '06:47:00', '일산', 'K7106', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2667, 'siheung_up', 'sunday', '07:03:00', '대곡', 'K7210', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2668, 'siheung_up', 'sunday', '07:20:00', '일산', 'K7108', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2669, 'siheung_up', 'sunday', '07:36:00', '대곡', 'K7212', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2670, 'siheung_up', 'sunday', '07:51:00', '일산', 'K7110', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2671, 'siheung_up', 'sunday', '08:05:00', '대곡', 'K7214', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2672, 'siheung_up', 'sunday', '08:20:00', '일산', 'K7112', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2673, 'siheung_up', 'sunday', '08:33:00', '대곡', 'K7216', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2674, 'siheung_up', 'sunday', '08:48:00', '대곡', 'K7218', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2675, 'siheung_up', 'sunday', '09:04:00', '일산', 'K7114', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2676, 'siheung_up', 'sunday', '09:18:00', '대곡', 'K7220', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2677, 'siheung_up', 'sunday', '09:34:00', '대곡', 'K7222', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2678, 'siheung_up', 'sunday', '09:48:00', '대곡', 'K7224', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2679, 'siheung_up', 'sunday', '10:03:00', '일산', 'K7116', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2680, 'siheung_up', 'sunday', '10:18:00', '대곡', 'K7226', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2681, 'siheung_up', 'sunday', '10:33:00', '일산', 'K7118', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2682, 'siheung_up', 'sunday', '10:48:00', '대곡', 'K7228', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2683, 'siheung_up', 'sunday', '11:04:00', '일산', 'K7120', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2684, 'siheung_up', 'sunday', '11:18:00', '대곡', 'K7230', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2685, 'siheung_up', 'sunday', '11:33:00', '일산', 'K7122', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2686, 'siheung_up', 'sunday', '11:47:00', '대곡', 'K7232', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2687, 'siheung_up', 'sunday', '12:02:00', '대곡', 'K7234', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2688, 'siheung_up', 'sunday', '12:18:00', '일산', 'K7124', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2689, 'siheung_up', 'sunday', '12:33:00', '대곡', 'K7236', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2690, 'siheung_up', 'sunday', '12:50:00', '일산', 'K7126', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2691, 'siheung_up', 'sunday', '13:04:00', '대곡', 'K7238', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2692, 'siheung_up', 'sunday', '13:19:00', '일산', 'K7128', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2693, 'siheung_up', 'sunday', '13:32:00', '대곡', 'K7240', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2694, 'siheung_up', 'sunday', '13:46:00', '일산', 'K7130', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2695, 'siheung_up', 'sunday', '14:01:00', '대곡', 'K7242', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2696, 'siheung_up', 'sunday', '14:17:00', '일산', 'K7132', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2697, 'siheung_up', 'sunday', '14:32:00', '대곡', 'K7244', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2698, 'siheung_up', 'sunday', '14:48:00', '일산', 'K7134', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2699, 'siheung_up', 'sunday', '15:03:00', '대곡', 'K7246', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2700, 'siheung_up', 'sunday', '15:18:00', '일산', 'K7136', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2701, 'siheung_up', 'sunday', '15:33:00', '대곡', 'K7248', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2702, 'siheung_up', 'sunday', '15:48:00', '일산', 'K7138', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2703, 'siheung_up', 'sunday', '16:03:00', '대곡', 'K7250', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2704, 'siheung_up', 'sunday', '16:20:00', '일산', 'K7140', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2705, 'siheung_up', 'sunday', '16:33:00', '대곡', 'K7252', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2706, 'siheung_up', 'sunday', '16:49:00', '일산', 'K7142', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2707, 'siheung_up', 'sunday', '17:00:00', '대곡', 'K7254', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2708, 'siheung_up', 'sunday', '17:13:00', '일산', 'K7144', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2709, 'siheung_up', 'sunday', '17:32:00', '대곡', 'K7256', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2710, 'siheung_up', 'sunday', '17:46:00', '일산', 'K7146', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2711, 'siheung_up', 'sunday', '18:02:00', '대곡', 'K7258', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2712, 'siheung_up', 'sunday', '18:18:00', '대곡', 'K7260', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2713, 'siheung_up', 'sunday', '18:33:00', '일산', 'K7148', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2714, 'siheung_up', 'sunday', '18:44:00', '대곡', 'K7262', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2715, 'siheung_up', 'sunday', '19:02:00', '일산', 'K7150', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2716, 'siheung_up', 'sunday', '19:14:00', '대곡', 'K7264', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2717, 'siheung_up', 'sunday', '19:30:00', '대곡', 'K7266', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2718, 'siheung_up', 'sunday', '19:49:00', '일산', 'K7152', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2719, 'siheung_up', 'sunday', '20:03:00', '대곡', 'K7268', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2720, 'siheung_up', 'sunday', '20:17:00', '일산', 'K7154', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2721, 'siheung_up', 'sunday', '20:33:00', '대곡', 'K7270', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2722, 'siheung_up', 'sunday', '20:48:00', '일산', 'K7156', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2723, 'siheung_up', 'sunday', '20:59:00', '대곡', 'K7272', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2724, 'siheung_up', 'sunday', '21:15:00', '대곡', 'K7274', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2725, 'siheung_up', 'sunday', '21:30:00', '대곡', 'K7276', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2726, 'siheung_up', 'sunday', '21:46:00', '대곡', 'K7278', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2727, 'siheung_up', 'sunday', '22:01:00', '일산', 'K7158', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2728, 'siheung_up', 'sunday', '22:16:00', '대곡', 'K7280', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2729, 'siheung_up', 'sunday', '22:36:00', '일산', 'K7160', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2730, 'siheung_up', 'sunday', '22:52:00', '대곡', 'K7282', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2731, 'siheung_up', 'sunday', '23:07:00', '대곡', 'K7284', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2732, 'siheung_up', 'sunday', '23:22:00', '일산', 'K7162', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2733, 'siheung_up', 'sunday', '23:47:00', '대곡', 'K7286', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2734, 'choji_dn', 'weekday', '00:08:30', '원시', 'K7161', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2735, 'choji_dn', 'weekday', '05:57:30', '원시', 'K7201', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2736, 'choji_dn', 'weekday', '06:12:30', '원시', 'K7101', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2737, 'choji_dn', 'weekday', '06:26:30', '원시', 'K7103', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2738, 'choji_dn', 'weekday', '06:41:30', '원시', 'K7203', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2739, 'choji_dn', 'weekday', '06:56:30', '원시', 'K7205', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2740, 'choji_dn', 'weekday', '07:12:30', '원시', 'K7207', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2741, 'choji_dn', 'weekday', '07:28:30', '원시', 'K7105', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2742, 'choji_dn', 'weekday', '07:42:30', '원시', 'K7209', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2743, 'choji_dn', 'weekday', '07:59:30', '원시', 'K7211', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2744, 'choji_dn', 'weekday', '08:15:30', '원시', 'K7213', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2745, 'choji_dn', 'weekday', '08:29:30', '원시', 'K7107', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2746, 'choji_dn', 'weekday', '08:44:30', '원시', 'K7215', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2747, 'choji_dn', 'weekday', '09:00:30', '원시', 'K7109', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2748, 'choji_dn', 'weekday', '09:21:30', '원시', 'K7217', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2749, 'choji_dn', 'weekday', '09:41:30', '원시', 'K7111', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2750, 'choji_dn', 'weekday', '09:53:30', '원시', 'K7219', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2751, 'choji_dn', 'weekday', '10:04:30', '원시', 'K7113', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2752, 'choji_dn', 'weekday', '10:15:30', '원시', 'K7221', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2753, 'choji_dn', 'weekday', '10:30:30', '원시', 'K7223', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2754, 'choji_dn', 'weekday', '10:45:30', '원시', 'K7115', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2755, 'choji_dn', 'weekday', '10:59:30', '원시', 'K7225', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2756, 'choji_dn', 'weekday', '11:13:30', '원시', 'K7117', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2757, 'choji_dn', 'weekday', '11:27:30', '원시', 'K7227', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2758, 'choji_dn', 'weekday', '11:42:30', '원시', 'K7229', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2759, 'choji_dn', 'weekday', '11:59:30', '원시', 'K7231', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2760, 'choji_dn', 'weekday', '12:13:30', '원시', 'K7119', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2761, 'choji_dn', 'weekday', '12:29:30', '원시', 'K7233', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2762, 'choji_dn', 'weekday', '12:44:30', '원시', 'K7121', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2763, 'choji_dn', 'weekday', '12:59:30', '원시', 'K7235', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2764, 'choji_dn', 'weekday', '13:12:30', '원시', 'K7123', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2765, 'choji_dn', 'weekday', '13:28:30', '원시', 'K7237', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2766, 'choji_dn', 'weekday', '13:43:30', '원시', 'K7239', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2767, 'choji_dn', 'weekday', '13:58:30', '원시', 'K7125', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2768, 'choji_dn', 'weekday', '14:14:30', '원시', 'K7241', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2769, 'choji_dn', 'weekday', '14:29:30', '원시', 'K7127', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2770, 'choji_dn', 'weekday', '14:44:30', '원시', 'K7243', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2771, 'choji_dn', 'weekday', '14:59:30', '원시', 'K7129', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2772, 'choji_dn', 'weekday', '15:12:30', '원시', 'K7245', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2773, 'choji_dn', 'weekday', '15:26:30', '원시', 'K7131', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2774, 'choji_dn', 'weekday', '15:41:30', '원시', 'K7247', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2775, 'choji_dn', 'weekday', '15:56:30', '원시', 'K7133', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2776, 'choji_dn', 'weekday', '16:13:30', '원시', 'K7249', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2777, 'choji_dn', 'weekday', '16:27:30', '원시', 'K7135', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2778, 'choji_dn', 'weekday', '16:44:30', '원시', 'K7251', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2779, 'choji_dn', 'weekday', '16:59:30', '원시', 'K7137', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2780, 'choji_dn', 'weekday', '17:13:30', '원시', 'K7253', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2781, 'choji_dn', 'weekday', '17:28:30', '원시', 'K7139', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2782, 'choji_dn', 'weekday', '17:43:30', '원시', 'K7255', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2783, 'choji_dn', 'weekday', '17:58:30', '원시', 'K7141', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2784, 'choji_dn', 'weekday', '18:14:30', '원시', 'K7257', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2785, 'choji_dn', 'weekday', '18:27:30', '원시', 'K7143', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2786, 'choji_dn', 'weekday', '18:41:30', '원시', 'K7259', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2787, 'choji_dn', 'weekday', '18:55:30', '원시', 'K7145', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2788, 'choji_dn', 'weekday', '19:13:30', '원시', 'K7261', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2789, 'choji_dn', 'weekday', '19:30:30', '원시', 'K7147', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2790, 'choji_dn', 'weekday', '19:43:30', '원시', 'K7263', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2791, 'choji_dn', 'weekday', '19:57:30', '원시', 'K7149', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2792, 'choji_dn', 'weekday', '20:13:30', '원시', 'K7265', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2793, 'choji_dn', 'weekday', '20:25:30', '원시', 'K7267', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2794, 'choji_dn', 'weekday', '20:40:30', '원시', 'K7151', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2795, 'choji_dn', 'weekday', '20:55:30', '원시', 'K7269', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2796, 'choji_dn', 'weekday', '21:11:30', '원시', 'K7271', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2797, 'choji_dn', 'weekday', '21:26:30', '원시', 'K7153', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2798, 'choji_dn', 'weekday', '21:44:30', '원시', 'K7273', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2799, 'choji_dn', 'weekday', '22:02:30', '원시', 'K7155', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2800, 'choji_dn', 'weekday', '22:15:30', '원시', 'K7275', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2801, 'choji_dn', 'weekday', '22:29:30', '원시', 'K7157', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2802, 'choji_dn', 'weekday', '22:42:30', '원시', 'K7277', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2803, 'choji_dn', 'weekday', '22:58:30', '원시', 'K7279', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2804, 'choji_dn', 'weekday', '23:13:30', '원시', 'K7159', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2805, 'choji_dn', 'weekday', '23:27:30', '원시', 'K7281', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2806, 'choji_dn', 'weekday', '23:42:30', '원시', 'K7283', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2807, 'choji_dn', 'weekday', '23:57:30', '원시', 'K7285', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2808, 'choji_up', 'weekday', '05:11:00', '일산', 'K7102', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2809, 'choji_up', 'weekday', '05:20:00', '대곡', 'K7202', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2810, 'choji_up', 'weekday', '05:33:00', '대곡', 'K7204', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2811, 'choji_up', 'weekday', '05:46:00', '일산', 'K7104', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2812, 'choji_up', 'weekday', '06:03:00', '대곡', 'K7206', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2813, 'choji_up', 'weekday', '06:19:00', '대곡', 'K7208', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2814, 'choji_up', 'weekday', '06:35:00', '일산', 'K7106', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2815, 'choji_up', 'weekday', '06:51:00', '대곡', 'K7210', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2816, 'choji_up', 'weekday', '07:08:00', '일산', 'K7108', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2817, 'choji_up', 'weekday', '07:24:00', '대곡', 'K7212', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2818, 'choji_up', 'weekday', '07:39:00', '일산', 'K7110', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2819, 'choji_up', 'weekday', '07:53:00', '대곡', 'K7214', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2820, 'choji_up', 'weekday', '08:08:00', '일산', 'K7112', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2821, 'choji_up', 'weekday', '08:21:00', '대곡', 'K7216', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2822, 'choji_up', 'weekday', '08:36:00', '대곡', 'K7218', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2823, 'choji_up', 'weekday', '08:52:00', '일산', 'K7114', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2824, 'choji_up', 'weekday', '09:06:00', '대곡', 'K7220', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2825, 'choji_up', 'weekday', '09:22:00', '대곡', 'K7222', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2826, 'choji_up', 'weekday', '09:36:00', '대곡', 'K7224', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2827, 'choji_up', 'weekday', '09:51:00', '일산', 'K7116', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2828, 'choji_up', 'weekday', '10:06:00', '대곡', 'K7226', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2829, 'choji_up', 'weekday', '10:21:00', '일산', 'K7118', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2830, 'choji_up', 'weekday', '10:36:00', '대곡', 'K7228', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2831, 'choji_up', 'weekday', '10:52:00', '일산', 'K7120', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2832, 'choji_up', 'weekday', '11:06:00', '대곡', 'K7230', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2833, 'choji_up', 'weekday', '11:21:00', '일산', 'K7122', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2834, 'choji_up', 'weekday', '11:35:00', '대곡', 'K7232', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2835, 'choji_up', 'weekday', '11:50:00', '대곡', 'K7234', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2836, 'choji_up', 'weekday', '12:06:00', '일산', 'K7124', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2837, 'choji_up', 'weekday', '12:21:00', '대곡', 'K7236', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2838, 'choji_up', 'weekday', '12:38:00', '일산', 'K7126', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2839, 'choji_up', 'weekday', '12:52:00', '대곡', 'K7238', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2840, 'choji_up', 'weekday', '13:07:00', '일산', 'K7128', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2841, 'choji_up', 'weekday', '13:20:00', '대곡', 'K7240', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2842, 'choji_up', 'weekday', '13:34:00', '일산', 'K7130', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2843, 'choji_up', 'weekday', '13:49:00', '대곡', 'K7242', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2844, 'choji_up', 'weekday', '14:05:00', '일산', 'K7132', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2845, 'choji_up', 'weekday', '14:20:00', '대곡', 'K7244', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2846, 'choji_up', 'weekday', '14:36:00', '일산', 'K7134', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2847, 'choji_up', 'weekday', '14:51:00', '대곡', 'K7246', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2848, 'choji_up', 'weekday', '15:06:00', '일산', 'K7136', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2849, 'choji_up', 'weekday', '15:21:00', '대곡', 'K7248', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2850, 'choji_up', 'weekday', '15:36:00', '일산', 'K7138', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2851, 'choji_up', 'weekday', '15:51:00', '대곡', 'K7250', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2852, 'choji_up', 'weekday', '16:08:00', '일산', 'K7140', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2853, 'choji_up', 'weekday', '16:21:00', '대곡', 'K7252', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2854, 'choji_up', 'weekday', '16:37:00', '일산', 'K7142', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2855, 'choji_up', 'weekday', '16:48:00', '대곡', 'K7254', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2856, 'choji_up', 'weekday', '17:01:00', '일산', 'K7144', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2857, 'choji_up', 'weekday', '17:20:00', '대곡', 'K7256', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2858, 'choji_up', 'weekday', '17:34:00', '일산', 'K7146', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2859, 'choji_up', 'weekday', '17:50:00', '대곡', 'K7258', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2860, 'choji_up', 'weekday', '18:06:00', '대곡', 'K7260', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2861, 'choji_up', 'weekday', '18:21:00', '일산', 'K7148', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2862, 'choji_up', 'weekday', '18:32:00', '대곡', 'K7262', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2863, 'choji_up', 'weekday', '18:50:00', '일산', 'K7150', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2864, 'choji_up', 'weekday', '19:02:00', '대곡', 'K7264', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2865, 'choji_up', 'weekday', '19:18:00', '대곡', 'K7266', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2866, 'choji_up', 'weekday', '19:37:00', '일산', 'K7152', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2867, 'choji_up', 'weekday', '19:51:00', '대곡', 'K7268', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2868, 'choji_up', 'weekday', '20:05:00', '일산', 'K7154', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2869, 'choji_up', 'weekday', '20:21:00', '대곡', 'K7270', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2870, 'choji_up', 'weekday', '20:36:00', '일산', 'K7156', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2871, 'choji_up', 'weekday', '20:47:00', '대곡', 'K7272', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2872, 'choji_up', 'weekday', '21:03:00', '대곡', 'K7274', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2873, 'choji_up', 'weekday', '21:18:00', '대곡', 'K7276', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2874, 'choji_up', 'weekday', '21:34:00', '대곡', 'K7278', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2875, 'choji_up', 'weekday', '21:49:00', '일산', 'K7158', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2876, 'choji_up', 'weekday', '22:04:00', '대곡', 'K7280', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2877, 'choji_up', 'weekday', '22:24:00', '일산', 'K7160', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2878, 'choji_up', 'weekday', '22:40:00', '대곡', 'K7282', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2879, 'choji_up', 'weekday', '22:55:00', '대곡', 'K7284', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2880, 'choji_up', 'weekday', '23:10:00', '일산', 'K7162', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2881, 'choji_up', 'weekday', '23:35:00', '대곡', 'K7286', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2882, 'siheung_dn', 'weekday', '05:45:00', '원시', 'K7201', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2883, 'siheung_dn', 'weekday', '06:00:00', '원시', 'K7101', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2884, 'siheung_dn', 'weekday', '06:14:00', '원시', 'K7103', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2885, 'siheung_dn', 'weekday', '06:29:00', '원시', 'K7203', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2886, 'siheung_dn', 'weekday', '06:44:00', '원시', 'K7205', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2887, 'siheung_dn', 'weekday', '07:00:00', '원시', 'K7207', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2888, 'siheung_dn', 'weekday', '07:16:00', '원시', 'K7105', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2889, 'siheung_dn', 'weekday', '07:30:00', '원시', 'K7209', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2890, 'siheung_dn', 'weekday', '07:47:00', '원시', 'K7211', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2891, 'siheung_dn', 'weekday', '08:03:00', '원시', 'K7213', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2892, 'siheung_dn', 'weekday', '08:17:00', '원시', 'K7107', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2893, 'siheung_dn', 'weekday', '08:32:00', '원시', 'K7215', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2894, 'siheung_dn', 'weekday', '08:48:00', '원시', 'K7109', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2895, 'siheung_dn', 'weekday', '09:09:00', '원시', 'K7217', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2896, 'siheung_dn', 'weekday', '09:29:00', '원시', 'K7111', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2897, 'siheung_dn', 'weekday', '09:41:00', '원시', 'K7219', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2898, 'siheung_dn', 'weekday', '09:52:00', '원시', 'K7113', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2899, 'siheung_dn', 'weekday', '10:03:00', '원시', 'K7221', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2900, 'siheung_dn', 'weekday', '10:18:00', '원시', 'K7223', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2901, 'siheung_dn', 'weekday', '10:33:00', '원시', 'K7115', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2902, 'siheung_dn', 'weekday', '10:47:00', '원시', 'K7225', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2903, 'siheung_dn', 'weekday', '11:01:00', '원시', 'K7117', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2904, 'siheung_dn', 'weekday', '11:15:00', '원시', 'K7227', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2905, 'siheung_dn', 'weekday', '11:30:00', '원시', 'K7229', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2906, 'siheung_dn', 'weekday', '11:47:00', '원시', 'K7231', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2907, 'siheung_dn', 'weekday', '12:01:00', '원시', 'K7119', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2908, 'siheung_dn', 'weekday', '12:17:00', '원시', 'K7233', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2909, 'siheung_dn', 'weekday', '12:32:00', '원시', 'K7121', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2910, 'siheung_dn', 'weekday', '12:47:00', '원시', 'K7235', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2911, 'siheung_dn', 'weekday', '13:00:00', '원시', 'K7123', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2912, 'siheung_dn', 'weekday', '13:16:00', '원시', 'K7237', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2913, 'siheung_dn', 'weekday', '13:31:00', '원시', 'K7239', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2914, 'siheung_dn', 'weekday', '13:46:00', '원시', 'K7125', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2915, 'siheung_dn', 'weekday', '14:02:00', '원시', 'K7241', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2916, 'siheung_dn', 'weekday', '14:17:00', '원시', 'K7127', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2917, 'siheung_dn', 'weekday', '14:32:00', '원시', 'K7243', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2918, 'siheung_dn', 'weekday', '14:47:00', '원시', 'K7129', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2919, 'siheung_dn', 'weekday', '15:00:00', '원시', 'K7245', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2920, 'siheung_dn', 'weekday', '15:14:00', '원시', 'K7131', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2921, 'siheung_dn', 'weekday', '15:29:00', '원시', 'K7247', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2922, 'siheung_dn', 'weekday', '15:44:00', '원시', 'K7133', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2923, 'siheung_dn', 'weekday', '16:01:00', '원시', 'K7249', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2924, 'siheung_dn', 'weekday', '16:15:00', '원시', 'K7135', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2925, 'siheung_dn', 'weekday', '16:32:00', '원시', 'K7251', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2926, 'siheung_dn', 'weekday', '16:47:00', '원시', 'K7137', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2927, 'siheung_dn', 'weekday', '17:01:00', '원시', 'K7253', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2928, 'siheung_dn', 'weekday', '17:16:00', '원시', 'K7139', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2929, 'siheung_dn', 'weekday', '17:31:00', '원시', 'K7255', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2930, 'siheung_dn', 'weekday', '17:46:00', '원시', 'K7141', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2931, 'siheung_dn', 'weekday', '18:02:00', '원시', 'K7257', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2932, 'siheung_dn', 'weekday', '18:15:00', '원시', 'K7143', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2933, 'siheung_dn', 'weekday', '18:29:00', '원시', 'K7259', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2934, 'siheung_dn', 'weekday', '18:43:00', '원시', 'K7145', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2935, 'siheung_dn', 'weekday', '19:01:00', '원시', 'K7261', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2936, 'siheung_dn', 'weekday', '19:18:00', '원시', 'K7147', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2937, 'siheung_dn', 'weekday', '19:31:00', '원시', 'K7263', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2938, 'siheung_dn', 'weekday', '19:45:00', '원시', 'K7149', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2939, 'siheung_dn', 'weekday', '20:01:00', '원시', 'K7265', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2940, 'siheung_dn', 'weekday', '20:13:00', '원시', 'K7267', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2941, 'siheung_dn', 'weekday', '20:28:00', '원시', 'K7151', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2942, 'siheung_dn', 'weekday', '20:43:00', '원시', 'K7269', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2943, 'siheung_dn', 'weekday', '20:59:00', '원시', 'K7271', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2944, 'siheung_dn', 'weekday', '21:14:00', '원시', 'K7153', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2945, 'siheung_dn', 'weekday', '21:32:00', '원시', 'K7273', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2946, 'siheung_dn', 'weekday', '21:50:00', '원시', 'K7155', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2947, 'siheung_dn', 'weekday', '22:03:00', '원시', 'K7275', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2948, 'siheung_dn', 'weekday', '22:17:00', '원시', 'K7157', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2949, 'siheung_dn', 'weekday', '22:30:00', '원시', 'K7277', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2950, 'siheung_dn', 'weekday', '22:46:00', '원시', 'K7279', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2951, 'siheung_dn', 'weekday', '23:01:00', '원시', 'K7159', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2952, 'siheung_dn', 'weekday', '23:15:00', '원시', 'K7281', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2953, 'siheung_dn', 'weekday', '23:30:00', '원시', 'K7283', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2954, 'siheung_dn', 'weekday', '23:45:00', '원시', 'K7285', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2955, 'siheung_dn', 'weekday', '23:56:00', '원시', 'K7161', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2956, 'siheung_up', 'weekday', '05:23:00', '일산', 'K7102', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2957, 'siheung_up', 'weekday', '05:32:00', '대곡', 'K7202', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2958, 'siheung_up', 'weekday', '05:45:00', '대곡', 'K7204', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2959, 'siheung_up', 'weekday', '05:58:00', '일산', 'K7104', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2960, 'siheung_up', 'weekday', '06:15:00', '대곡', 'K7206', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2961, 'siheung_up', 'weekday', '06:31:00', '대곡', 'K7208', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2962, 'siheung_up', 'weekday', '06:47:00', '일산', 'K7106', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2963, 'siheung_up', 'weekday', '07:03:00', '대곡', 'K7210', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2964, 'siheung_up', 'weekday', '07:20:00', '일산', 'K7108', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2965, 'siheung_up', 'weekday', '07:36:00', '대곡', 'K7212', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2966, 'siheung_up', 'weekday', '07:51:00', '일산', 'K7110', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2967, 'siheung_up', 'weekday', '08:05:00', '대곡', 'K7214', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2968, 'siheung_up', 'weekday', '08:20:00', '일산', 'K7112', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2969, 'siheung_up', 'weekday', '08:33:00', '대곡', 'K7216', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2970, 'siheung_up', 'weekday', '08:48:00', '대곡', 'K7218', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2971, 'siheung_up', 'weekday', '09:04:00', '일산', 'K7114', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2972, 'siheung_up', 'weekday', '09:18:00', '대곡', 'K7220', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2973, 'siheung_up', 'weekday', '09:34:00', '대곡', 'K7222', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2974, 'siheung_up', 'weekday', '09:48:00', '대곡', 'K7224', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2975, 'siheung_up', 'weekday', '10:03:00', '일산', 'K7116', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2976, 'siheung_up', 'weekday', '10:18:00', '대곡', 'K7226', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2977, 'siheung_up', 'weekday', '10:33:00', '일산', 'K7118', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2978, 'siheung_up', 'weekday', '10:48:00', '대곡', 'K7228', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2979, 'siheung_up', 'weekday', '11:04:00', '일산', 'K7120', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2980, 'siheung_up', 'weekday', '11:18:00', '대곡', 'K7230', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2981, 'siheung_up', 'weekday', '11:33:00', '일산', 'K7122', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2982, 'siheung_up', 'weekday', '11:47:00', '대곡', 'K7232', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2983, 'siheung_up', 'weekday', '12:02:00', '대곡', 'K7234', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2984, 'siheung_up', 'weekday', '12:18:00', '일산', 'K7124', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2985, 'siheung_up', 'weekday', '12:33:00', '대곡', 'K7236', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2986, 'siheung_up', 'weekday', '12:50:00', '일산', 'K7126', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2987, 'siheung_up', 'weekday', '13:04:00', '대곡', 'K7238', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2988, 'siheung_up', 'weekday', '13:19:00', '일산', 'K7128', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2989, 'siheung_up', 'weekday', '13:32:00', '대곡', 'K7240', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2990, 'siheung_up', 'weekday', '13:46:00', '일산', 'K7130', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2991, 'siheung_up', 'weekday', '14:01:00', '대곡', 'K7242', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2992, 'siheung_up', 'weekday', '14:17:00', '일산', 'K7132', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2993, 'siheung_up', 'weekday', '14:32:00', '대곡', 'K7244', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2994, 'siheung_up', 'weekday', '14:48:00', '일산', 'K7134', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2995, 'siheung_up', 'weekday', '15:03:00', '대곡', 'K7246', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2996, 'siheung_up', 'weekday', '15:18:00', '일산', 'K7136', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2997, 'siheung_up', 'weekday', '15:33:00', '대곡', 'K7248', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2998, 'siheung_up', 'weekday', '15:48:00', '일산', 'K7138', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (2999, 'siheung_up', 'weekday', '16:03:00', '대곡', 'K7250', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3000, 'siheung_up', 'weekday', '16:20:00', '일산', 'K7140', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3001, 'siheung_up', 'weekday', '16:33:00', '대곡', 'K7252', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3002, 'siheung_up', 'weekday', '16:49:00', '일산', 'K7142', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3003, 'siheung_up', 'weekday', '17:00:00', '대곡', 'K7254', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3004, 'siheung_up', 'weekday', '17:13:00', '일산', 'K7144', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3005, 'siheung_up', 'weekday', '17:32:00', '대곡', 'K7256', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3006, 'siheung_up', 'weekday', '17:46:00', '일산', 'K7146', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3007, 'siheung_up', 'weekday', '18:02:00', '대곡', 'K7258', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3008, 'siheung_up', 'weekday', '18:18:00', '대곡', 'K7260', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3009, 'siheung_up', 'weekday', '18:33:00', '일산', 'K7148', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3010, 'siheung_up', 'weekday', '18:44:00', '대곡', 'K7262', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3011, 'siheung_up', 'weekday', '19:02:00', '일산', 'K7150', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3012, 'siheung_up', 'weekday', '19:14:00', '대곡', 'K7264', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3013, 'siheung_up', 'weekday', '19:30:00', '대곡', 'K7266', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3014, 'siheung_up', 'weekday', '19:49:00', '일산', 'K7152', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3015, 'siheung_up', 'weekday', '20:03:00', '대곡', 'K7268', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3016, 'siheung_up', 'weekday', '20:17:00', '일산', 'K7154', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3017, 'siheung_up', 'weekday', '20:33:00', '대곡', 'K7270', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3018, 'siheung_up', 'weekday', '20:48:00', '일산', 'K7156', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3019, 'siheung_up', 'weekday', '20:59:00', '대곡', 'K7272', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3020, 'siheung_up', 'weekday', '21:15:00', '대곡', 'K7274', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3021, 'siheung_up', 'weekday', '21:30:00', '대곡', 'K7276', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3022, 'siheung_up', 'weekday', '21:46:00', '대곡', 'K7278', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3023, 'siheung_up', 'weekday', '22:01:00', '일산', 'K7158', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3024, 'siheung_up', 'weekday', '22:16:00', '대곡', 'K7280', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3025, 'siheung_up', 'weekday', '22:36:00', '일산', 'K7160', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3026, 'siheung_up', 'weekday', '22:52:00', '대곡', 'K7282', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3027, 'siheung_up', 'weekday', '23:07:00', '대곡', 'K7284', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3028, 'siheung_up', 'weekday', '23:22:00', '일산', 'K7162', '2026-05-16 06:27:54.364337+00');
INSERT INTO subway_timetable_entries (id, direction, day_type, departure_time, destination, train_no, updated_at) VALUES (3029, 'siheung_up', 'weekday', '23:47:00', '대곡', 'K7286', '2026-05-16 06:27:54.364337+00');


--
-- Name: app_info_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('app_info_id_seq', 1, false);


--
-- Name: app_links_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('app_links_id_seq', 1, false);


--
-- Name: bus_arrival_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('bus_arrival_history_id_seq', 956, true);


--
-- Name: bus_crowding_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('bus_crowding_logs_id_seq', 7758, true);


--
-- Name: bus_routes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('bus_routes_id_seq', 17, true);


--
-- Name: bus_stops_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('bus_stops_id_seq', 17, true);


--
-- Name: bus_timetable_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('bus_timetable_entries_id_seq', 1005, true);


--
-- Name: map_marker_routes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('map_marker_routes_id_seq', 14, true);


--
-- Name: map_markers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('map_markers_id_seq', 12, true);


--
-- Name: notices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('notices_id_seq', 3, true);


--
-- Name: schedule_periods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('schedule_periods_id_seq', 1, true);


--
-- Name: shuttle_routes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('shuttle_routes_id_seq', 6, true);


--
-- Name: shuttle_timetable_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('shuttle_timetable_entries_id_seq', 121, true);


--
-- Name: subway_timetable_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('subway_timetable_entries_id_seq', 2141, true);


--
-- Name: traffic_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('traffic_history_id_seq', 2781, true);


--

-- ============================================================
-- 초기화 후 실행 순서
-- 1. docker compose down -v && docker compose up -d
--    (postgres init-script → 스키마 + 시드 적용)
-- 2. 지하철 시간표는 이미 시드에 포함되어 있으나 최신 반영이 필요하면
--    POST /api/v1/admin/subway/refresh (lifespan에서 자동 실행)
-- ============================================================
