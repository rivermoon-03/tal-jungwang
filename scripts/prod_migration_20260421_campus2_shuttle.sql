-- ============================================================
-- prod 직접 적용 마이그레이션 — 2026-04-21
-- 한국공학대학교 제2캠퍼스 셔틀 추가
--   - shuttle_routes.direction CHECK 확장 (0,1) -> (0,1,2,3)
--   - shuttle_routes 2건 (id=7 제2 등교, id=8 제2 하교)
--   - shuttle_timetable_entries 36건 (평일/토요일 × 등교/하교)
--   - map_markers 3건 (산융관 앞, 제2캠퍼스 정문, 꽃집앞)
-- 적용: psql "$DATABASE_URL" -f scripts/prod_migration_20260421_campus2_shuttle.sql
-- ============================================================

BEGIN;

-- 1. shuttle_routes.direction CHECK 확장
ALTER TABLE shuttle_routes DROP CONSTRAINT IF EXISTS shuttle_routes_direction_check;
ALTER TABLE shuttle_routes
    ADD CONSTRAINT shuttle_routes_direction_check CHECK (direction IN (0,1,2,3));

-- 2. 제2캠퍼스 노선 2건
INSERT INTO shuttle_routes (id, direction, description) VALUES
  (7, 2, '본교 출발 → 한국공학대학교 제2캠퍼스 (제2 등교)'),
  (8, 3, '한국공학대학교 제2캠퍼스 → 본교 (제2 하교)')
ON CONFLICT (id) DO NOTHING;

-- 3. 평일 direction=2 (본교→제2캠퍼스)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES
  (1, 7, 'weekday', '08:55:00', '정왕역 08:55 출발 (서문 경유)'),
  (1, 7, 'weekday', '09:00:00', '정왕역 09:00 출발 (서문 경유)'),
  (1, 7, 'weekday', '10:00:00', NULL),
  (1, 7, 'weekday', '11:00:00', NULL),
  (1, 7, 'weekday', '12:00:00', NULL),
  (1, 7, 'weekday', '13:00:00', NULL),
  (1, 7, 'weekday', '14:00:00', NULL),
  (1, 7, 'weekday', '15:00:00', NULL),
  (1, 7, 'weekday', '16:00:00', NULL),
  (1, 7, 'weekday', '17:00:00', NULL),
  (1, 7, 'weekday', '18:00:00', NULL),
  (1, 7, 'weekday', '19:00:00', NULL);

-- 4. 평일 direction=3 (제2캠퍼스→본교)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES
  (1, 8, 'weekday', '09:40:00', NULL),
  (1, 8, 'weekday', '10:30:00', NULL),
  (1, 8, 'weekday', '11:30:00', NULL),
  (1, 8, 'weekday', '12:30:00', NULL),
  (1, 8, 'weekday', '13:30:00', NULL),
  (1, 8, 'weekday', '14:30:00', NULL),
  (1, 8, 'weekday', '15:30:00', NULL),
  (1, 8, 'weekday', '16:30:00', NULL),
  (1, 8, 'weekday', '17:40:00', '오이도역 도착'),
  (1, 8, 'weekday', '18:30:00', NULL),
  (1, 8, 'weekday', '19:30:00', NULL);

-- 5. 토요일 direction=2 (정왕역 꽃집앞 → 본교 서문 → 제2캠퍼스)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES
  (1, 7, 'saturday', '08:45:00', '정왕역 출발 (서문 경유)'),
  (1, 7, 'saturday', '08:50:00', '정왕역 출발 (서문 경유)'),
  (1, 7, 'saturday', '09:00:00', '정왕역 출발 (서문 경유)'),
  (1, 7, 'saturday', '09:05:00', '정왕역 출발 (서문 경유)'),
  (1, 7, 'saturday', '09:10:00', '정왕역 출발 (서문 경유)'),
  (1, 7, 'saturday', '09:15:00', '정왕역 출발 (서문 경유)');

-- 6. 토요일 direction=3 (제2캠퍼스 → 본교 서문 → 정왕역)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note) VALUES
  (1, 8, 'saturday', '16:30:00', '정왕역 종착 (서문 경유)'),
  (1, 8, 'saturday', '16:45:00', '정왕역 종착 (서문 경유)'),
  (1, 8, 'saturday', '19:25:00', '정왕역 종착 (서문 경유)'),
  (1, 8, 'saturday', '19:28:00', '정왕역 종착 (서문 경유)'),
  (1, 8, 'saturday', '19:30:00', '정왕역 종착 (서문 경유)'),
  (1, 8, 'saturday', '19:35:00', '정왕역 종착 (서문 경유)'),
  (1, 8, 'saturday', '19:45:00', '정왕역 종착 (서문 경유)');

-- 7. 지도 마커 3건
INSERT INTO map_markers (marker_key, marker_type, display_name, lat, lng, sort_order, ui_meta, is_active) VALUES
  ('shuttle2_to_campus2',   'shuttle', '제2 등교',    37.338833, 126.733778, 30,
   '{"showLive": true, "direction": 2, "routeCode": "제2 등교", "routeColor": "#FF385C"}'::jsonb, true),
  ('shuttle2_from_campus2', 'shuttle', '제2 하교',    37.327877, 126.688509, 40,
   '{"showLive": true, "direction": 3, "routeCode": "제2 하교", "routeColor": "#FF385C"}'::jsonb, true),
  ('shuttle2_ggotjip',      'shuttle', '꽃집앞 (제2)', 37.350833, 126.742848, 35,
   '{"showLive": true, "direction": 2, "routeCode": "제2 등교", "routeColor": "#FF385C", "variant": "via_station"}'::jsonb, true)
ON CONFLICT (marker_key) DO NOTHING;

COMMIT;
