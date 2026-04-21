-- ============================================================
-- 시흥시청역 발 등교 방향 3개 버스 노선 추가
-- 작성: 2026-04-21
-- 목적: 5602·시흥33·3401 등교를 실시간 폴링 대상에 합류
-- 멱등: 재실행 안전 (INSERT/UPDATE/ON CONFLICT)
-- 적용 대상: 로컬 + prod 동일 SQL
-- ============================================================
BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. bus_stops — 시흥시청역 1개 + 한공대 쪽 등교 도착지 3개
-- ────────────────────────────────────────────────────────────

-- 시흥시청역 (GBIS 실시간 대상)
INSERT INTO bus_stops (name, gbis_station_id, lat, lng, sub_name)
VALUES ('시흥시청역', '224000586', 37.381656, 126.805878, '서해선 환승')
ON CONFLICT (gbis_station_id) DO UPDATE
  SET name      = EXCLUDED.name,
      lat       = EXCLUDED.lat,
      lng       = EXCLUDED.lng,
      sub_name  = EXCLUDED.sub_name;

-- 한공대 쪽 등교 하차 정류장 3개 (gbis_station_id = NULL)
-- name 기준 중복 방지
INSERT INTO bus_stops (name, gbis_station_id, lat, lng, sub_name)
SELECT v.name, NULL, v.lat, v.lng, v.sub_name
FROM (VALUES
  ('한국공학대학교.시화버스터미널', 37.342980::NUMERIC(9,6), 126.734806::NUMERIC(9,6), '5602 등교 하차'),
  ('한국공학대학교(등교)',           37.341101::NUMERIC(9,6), 126.730547::NUMERIC(9,6), '시흥33 등교 하차'),
  ('이마트(등교)',                   37.346089::NUMERIC(9,6), 126.737394::NUMERIC(9,6), '3401 등교 하차')
) AS v(name, lat, lng, sub_name)
WHERE NOT EXISTS (
  SELECT 1 FROM bus_stops bs WHERE bs.name = v.name
);

-- ────────────────────────────────────────────────────────────
-- 2. bus_routes — 3개 등교 노선
--    5602·3401 등교: 기존 행(gbis_route_id NULL) UPDATE
--    시흥33 등교:    신규 INSERT (하교판과 gbis_route_id 공유)
-- ────────────────────────────────────────────────────────────

UPDATE bus_routes
SET gbis_route_id  = '216000047',
    route_name     = '5602번',
    direction_name = '한국공학대학교.시화버스터미널'
WHERE route_number = '5602'
  AND category     = '등교';

UPDATE bus_routes
SET gbis_route_id  = '224000071',
    direction_name = '이마트 방면'
WHERE route_number = '3401'
  AND category     = '등교';

INSERT INTO bus_routes (route_number, route_name, direction_name, gbis_route_id, category)
VALUES ('시흥33', '시흥33번', '한국공학대학교 방면', '224000062', '등교')
ON CONFLICT ON CONSTRAINT uq_bus_routes_number_category DO UPDATE
  SET gbis_route_id  = EXCLUDED.gbis_route_id,
      route_name     = EXCLUDED.route_name,
      direction_name = EXCLUDED.direction_name;

-- ────────────────────────────────────────────────────────────
-- 3. bus_stop_routes — 6개 연결
--   · 시흥시청역 ↔ 3개 등교 (실시간 폴링 매칭용)
--   · 각 등교 ↔ 한공대 쪽 도착지 (하차 정보용)
-- ────────────────────────────────────────────────────────────
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id)
SELECT bs.id, br.id
FROM bus_stops bs, bus_routes br
WHERE (
     (bs.gbis_station_id = '224000586' AND br.route_number = '5602'   AND br.category = '등교')
  OR (bs.gbis_station_id = '224000586' AND br.route_number = '시흥33' AND br.category = '등교')
  OR (bs.gbis_station_id = '224000586' AND br.route_number = '3401'   AND br.category = '등교')
  OR (bs.name = '한국공학대학교.시화버스터미널' AND br.route_number = '5602'   AND br.category = '등교')
  OR (bs.name = '한국공학대학교(등교)'           AND br.route_number = '시흥33' AND br.category = '등교')
  OR (bs.name = '이마트(등교)'                   AND br.route_number = '3401'   AND br.category = '등교')
)
ON CONFLICT (bus_stop_id, bus_route_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 4. map_marker_routes — 시흥시청 seohae 마커에 3개 등교 노선 연결
--    outbound_stop_id = 시흥시청역 승차
--    inbound_stop_id  = 한공대 쪽 하차 정류장
-- ────────────────────────────────────────────────────────────
INSERT INTO map_marker_routes (
  marker_id, route_number, route_color, badge_text,
  outbound_stop_id, inbound_stop_id, sort_order
)
SELECT m.id, v.route_number, v.route_color, v.badge_text,
       v.out_sid, v.in_sid, v.sort_order
FROM map_markers m,
     (VALUES
       ('5602',   '#DC2626', 'G',
        (SELECT id FROM bus_stops WHERE gbis_station_id = '224000586'),
        (SELECT id FROM bus_stops WHERE name = '한국공학대학교.시화버스터미널'),
        0),
       ('시흥33', '#0891B2', NULL,
        (SELECT id FROM bus_stops WHERE gbis_station_id = '224000586'),
        (SELECT id FROM bus_stops WHERE name = '한국공학대학교(등교)'),
        10),
       ('3401',   '#DC2626', 'G',
        (SELECT id FROM bus_stops WHERE gbis_station_id = '224000586'),
        (SELECT id FROM bus_stops WHERE name = '이마트(등교)'),
        20)
     ) AS v(route_number, route_color, badge_text, out_sid, in_sid, sort_order)
WHERE m.marker_key = 'siheung_station'
  AND NOT EXISTS (
    SELECT 1 FROM map_marker_routes mmr
    WHERE mmr.marker_id = m.id
      AND mmr.route_number = v.route_number
  );

COMMIT;

-- ============================================================
-- 검증 쿼리 (수동 실행)
-- ============================================================
-- SELECT id, route_number, category, gbis_route_id, direction_name
--   FROM bus_routes WHERE category = '등교' ORDER BY route_number;
-- → 3401·5602·시흥33 모두 gbis_route_id NOT NULL 확인
--
-- SELECT bs.name, br.route_number, br.category, br.gbis_route_id
--   FROM bus_stops bs
--   JOIN bus_stop_routes bsr ON bsr.bus_stop_id = bs.id
--   JOIN bus_routes br       ON br.id = bsr.bus_route_id
--  WHERE br.category = '등교' ORDER BY bs.name, br.route_number;
-- → 시흥시청역 3행 + 한공대 쪽 도착지 3행 = 6행
--
-- SELECT m.marker_key, mmr.route_number, mmr.route_color,
--        os.name AS out_stop, ins.name AS in_stop
--   FROM map_markers m
--   JOIN map_marker_routes mmr ON mmr.marker_id = m.id
--   LEFT JOIN bus_stops os  ON os.id = mmr.outbound_stop_id
--   LEFT JOIN bus_stops ins ON ins.id = mmr.inbound_stop_id
--  WHERE m.marker_key = 'siheung_station';
-- → 3행
