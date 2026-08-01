BEGIN;

-- 진행 방향이 다른 동명 정류장은 별도 GBIS station ID로 보존한다.
INSERT INTO bus_stops (name, gbis_station_id, lat, lng, sub_name)
VALUES
  ('시흥시청역(서울방향)', '224000538', 37.381656, 126.805878, '서울 방향'),
  ('이마트(반대편)', '224000567', 37.340300, 126.728500, '진행 방향 구분')
ON CONFLICT (gbis_station_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS bus_commute_contexts (
    id                SERIAL       PRIMARY KEY,
    bus_route_id      INTEGER      NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
    group_key         VARCHAR(40)  NOT NULL,
    origin_label      VARCHAR(100) NOT NULL,
    destination_label VARCHAR(100) NOT NULL,
    journey_labels    JSONB        NOT NULL DEFAULT '[]'::jsonb,
    sort_order        INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT uq_bus_commute_route_group UNIQUE (bus_route_id, group_key)
);

CREATE TABLE IF NOT EXISTS bus_information_sources (
    id               SERIAL       PRIMARY KEY,
    context_id       INTEGER      NOT NULL REFERENCES bus_commute_contexts(id) ON DELETE CASCADE,
    source_type      VARCHAR(20)  NOT NULL CHECK (source_type IN ('timetable', 'realtime')),
    source_role      VARCHAR(30)  NOT NULL CHECK (source_role IN ('departure', 'boarding_arrival', 'downstream_arrival')),
    bus_stop_id      INTEGER      NOT NULL REFERENCES bus_stops(id),
    display_label    VARCHAR(100) NOT NULL,
    travel_direction VARCHAR(30) NOT NULL,
    sort_order       INTEGER      NOT NULL DEFAULT 0,
    CONSTRAINT uq_bus_info_source_context_type_role_stop
        UNIQUE (context_id, source_type, source_role, bus_stop_id)
);

CREATE TABLE IF NOT EXISTS bus_realtime_targets (
    id               SERIAL      PRIMARY KEY,
    bus_route_id     INTEGER     NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
    bus_stop_id      INTEGER     NOT NULL REFERENCES bus_stops(id) ON DELETE CASCADE,
    travel_direction VARCHAR(30) NOT NULL,
    enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_bus_realtime_route_stop_direction
        UNIQUE (bus_route_id, bus_stop_id, travel_direction)
);

CREATE INDEX IF NOT EXISTS idx_bus_commute_context_group ON bus_commute_contexts (group_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_bus_information_source_context ON bus_information_sources (context_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_bus_realtime_target_stop ON bus_realtime_targets (bus_stop_id) WHERE enabled;

-- 기존 route/category를 통학 목적에 연결한다. 한 노선은 여러 group에 들어갈 수 있다.
INSERT INTO bus_commute_contexts
  (bus_route_id, group_key, origin_label, destination_label, journey_labels, sort_order)
SELECT br.id, seed.group_key, seed.origin_label, seed.destination_label, seed.journey_labels::jsonb, seed.sort_order
FROM (VALUES
  ('11-A','하교','to-jeongwang','한국공학대학교','정왕역','["한국공학대학교","정왕역"]',10),
  ('20-1','하교','to-jeongwang','한국공학대학교','정왕역','["한국공학대학교","정왕역"]',20),
  ('시흥33','하교','to-jeongwang','한국공학대학교','정왕역','["한국공학대학교","정왕역"]',30),
  ('시흥33','하교','to-siheung-city-hall','한국공학대학교','시흥시청역','["한국공학대학교","정왕역","시흥시청역"]',10),
  ('3400','하교','to-seoul','시흥터미널','강남역','["시흥터미널","이마트","사당역","강남역"]',10),
  ('3401','하교','to-siheung-city-hall','이마트','시흥시청역','["이마트","시흥시청역"]',20),
  ('3401','하교','to-seoul','이마트','석수역','["이마트","시흥시청역","광명","석수역"]',20),
  ('5602','하교','to-siheung-city-hall','이마트','시흥시청역','["이마트","시흥시청역"]',30),
  ('5602','하교','to-seoul','이마트','구로디지털단지역','["이마트","시흥시청역","구로디지털단지역"]',30),
  ('6502','하교','to-seoul','이마트','사당역','["이마트","사당역"]',40),
  ('5200','하교','to-seoul','시흥터미널·이마트','신도림역','["시흥터미널","이마트","신천역","신도림역"]',50),
  ('시흥1','하교','to-seoul','이마트','개봉','["이마트","신천역","개봉"]',60),
  ('3400','등교','from-seoul','강남역','학교 주변','["강남역","사당역","시흥터미널"]',10),
  ('3401','등교','from-seoul','석수역','학교 주변','["석수역","시흥시청역","이마트"]',20),
  ('5602','등교','from-seoul','구로디지털단지역','학교 주변','["구로디지털단지역","시흥시청역","이마트"]',30),
  ('6502','등교','from-seoul','사당역','학교 주변','["사당역","이마트"]',40),
  ('3401','등교','from-siheung-city-hall','시흥시청역','학교 주변','["시흥시청역","이마트"]',10),
  ('5602','등교','from-siheung-city-hall','시흥시청역','학교 주변','["시흥시청역","이마트"]',20),
  ('시흥33','등교','from-siheung-city-hall','시흥시청역','한국공학대학교','["시흥시청역","한국공학대학교"]',30)
) AS seed(route_number, category, group_key, origin_label, destination_label, journey_labels, sort_order)
JOIN bus_routes br ON br.route_number=seed.route_number AND br.category=seed.category
ON CONFLICT (bus_route_id, group_key) DO UPDATE SET
  origin_label=EXCLUDED.origin_label,
  destination_label=EXCLUDED.destination_label,
  journey_labels=EXCLUDED.journey_labels,
  sort_order=EXCLUDED.sort_order;

-- source: 시간표 기준점과 실시간 관측점을 절대로 같은 것으로 추론하지 않는다.
INSERT INTO bus_information_sources
  (context_id, source_type, source_role, bus_stop_id, display_label, travel_direction, sort_order)
SELECT bc.id, seed.source_type, seed.source_role, bs.id, seed.display_label, seed.travel_direction, seed.sort_order
FROM (VALUES
  ('3400','하교','to-seoul','timetable','departure','224000861','시흥터미널 출발','to-seoul',10),
  ('3400','하교','to-seoul','realtime','boarding_arrival','224000513','이마트 도착','to-seoul',20),
  ('3401','하교','to-seoul','timetable','departure','224000513','이마트 출발','to-seoul',10),
  ('3401','하교','to-seoul','realtime','downstream_arrival','224000538','시흥시청 도착','to-seoul',20),
  ('3401','하교','to-siheung-city-hall','timetable','departure','224000513','이마트 출발','to-seoul',10),
  ('3401','하교','to-siheung-city-hall','realtime','downstream_arrival','224000538','시흥시청 도착','to-seoul',20),
  ('5602','하교','to-seoul','timetable','departure','224000513','이마트 출발','to-seoul',10),
  ('5602','하교','to-seoul','realtime','downstream_arrival','224000538','시흥시청 도착','to-seoul',20),
  ('5602','하교','to-siheung-city-hall','timetable','departure','224000513','이마트 출발','to-seoul',10),
  ('5602','하교','to-siheung-city-hall','realtime','downstream_arrival','224000538','시흥시청 도착','to-seoul',20),
  ('6502','하교','to-seoul','timetable','departure','224000513','이마트 출발','to-seoul',10),
  ('5200','하교','to-seoul','realtime','boarding_arrival','224000861','시흥터미널 도착','to-seoul',10),
  ('5200','하교','to-seoul','realtime','boarding_arrival','224000513','이마트 도착','to-seoul',20),
  ('시흥1','하교','to-seoul','timetable','departure','224000513','이마트 출발','to-seoul',10),
  ('시흥1','하교','to-seoul','realtime','boarding_arrival','224000513','이마트 도착','to-seoul',20),
  ('11-A','하교','to-jeongwang','realtime','boarding_arrival','224000639','한국공학대학교 도착','to-jeongwang',10),
  ('20-1','하교','to-jeongwang','timetable','departure','224000639','한국공학대학교 출발','to-jeongwang',10),
  ('20-1','하교','to-jeongwang','realtime','boarding_arrival','224000639','한국공학대학교 도착','to-jeongwang',20),
  ('시흥33','하교','to-jeongwang','timetable','departure','224000639','한국공학대학교 출발','to-city-hall',10),
  ('시흥33','하교','to-jeongwang','realtime','boarding_arrival','224000639','한국공학대학교 도착','to-city-hall',20),
  ('시흥33','하교','to-siheung-city-hall','timetable','departure','224000639','한국공학대학교 출발','to-city-hall',10),
  ('시흥33','하교','to-siheung-city-hall','realtime','downstream_arrival','224000586','시흥시청 도착','to-city-hall',20),
  ('3400','등교','from-seoul','timetable','departure',NULL,'강남역 출발','from-seoul',10),
  ('3401','등교','from-seoul','timetable','departure',NULL,'석수역 출발','from-seoul',10),
  ('5602','등교','from-seoul','timetable','departure',NULL,'구로디지털단지역 출발','from-seoul',10),
  ('6502','등교','from-seoul','timetable','departure',NULL,'사당역 출발','from-seoul',10),
  ('3401','등교','from-siheung-city-hall','realtime','boarding_arrival','224000586','시흥시청 출발','from-city-hall',10),
  ('5602','등교','from-siheung-city-hall','realtime','boarding_arrival','224000586','시흥시청 출발','from-city-hall',10),
  ('시흥33','등교','from-siheung-city-hall','realtime','boarding_arrival','224000586','시흥시청 출발','from-city-hall',10)
) AS seed(route_number, category, group_key, source_type, source_role, gbis_station_id, display_label, travel_direction, sort_order)
JOIN bus_routes br ON br.route_number=seed.route_number AND br.category=seed.category
JOIN bus_commute_contexts bc ON bc.bus_route_id=br.id AND bc.group_key=seed.group_key
JOIN bus_stops bs ON bs.id = CASE
  WHEN seed.gbis_station_id IS NOT NULL THEN (SELECT id FROM bus_stops WHERE gbis_station_id=seed.gbis_station_id)
  WHEN seed.route_number='3400' THEN 6
  WHEN seed.route_number='3401' THEN 7
  WHEN seed.route_number='5602' THEN 8
  WHEN seed.route_number='6502' THEN 5
END
ON CONFLICT (context_id, source_type, source_role, bus_stop_id) DO UPDATE SET
  display_label=EXCLUDED.display_label,
  travel_direction=EXCLUDED.travel_direction,
  sort_order=EXCLUDED.sort_order;

-- 수집 대상은 route/stop/direction을 명시한다. 6502는 의도적으로 제외한다.
INSERT INTO bus_realtime_targets (bus_route_id, bus_stop_id, travel_direction, enabled)
SELECT br.id, bs.id, seed.travel_direction, TRUE
FROM (VALUES
  ('11-A','하교','224000639','to-jeongwang'),
  ('20-1','하교','224000639','to-jeongwang'),
  ('시흥33','하교','224000639','to-city-hall'),
  ('시흥33','하교','224000586','to-city-hall'),
  ('3400','하교','224000513','to-seoul'),
  ('3401','하교','224000538','to-seoul'),
  ('5602','하교','224000538','to-seoul'),
  ('5200','하교','224000861','to-seoul'),
  ('5200','하교','224000513','to-seoul'),
  ('시흥1','하교','224000513','to-seoul'),
  ('3401','등교','224000586','from-city-hall'),
  ('5602','등교','224000586','from-city-hall'),
  ('시흥33','등교','224000586','from-city-hall')
) AS seed(route_number, category, gbis_station_id, travel_direction)
JOIN bus_routes br ON br.route_number=seed.route_number AND br.category=seed.category
JOIN bus_stops bs ON bs.gbis_station_id=seed.gbis_station_id
ON CONFLICT (bus_route_id, bus_stop_id, travel_direction) DO UPDATE SET enabled=TRUE;

COMMIT;
