BEGIN;

-- 1. direction_name 정리
UPDATE bus_routes SET direction_name = '이마트(학교)'
WHERE route_number = '5602' AND category = '등교';

UPDATE bus_routes SET direction_name = '정왕역 방면'
WHERE route_number = '11-A' AND category = '하교';

-- 2. 3400 하교 timetable entries: stop_id=1 → 3
UPDATE bus_timetable_entries
SET stop_id = 3
WHERE route_id = (SELECT id FROM bus_routes WHERE route_number = '3400' AND category = '하교')
  AND stop_id = 1;

-- 3. 3400 하교 bus_stop_routes: bus_stop_id=1 → 3
UPDATE bus_stop_routes
SET bus_stop_id = 3
WHERE bus_route_id = (SELECT id FROM bus_routes WHERE route_number = '3400' AND category = '하교')
  AND bus_stop_id = 1;

-- 4. map_marker_routes: 3400 outbound_stop_id=1 → 3
UPDATE map_marker_routes
SET outbound_stop_id = 3
WHERE route_number = '3400'
  AND outbound_stop_id = 1;

-- 5. map_markers ui_meta에 primaryStopGbisId 추가
UPDATE map_markers
SET ui_meta = ui_meta || '{"primaryStopGbisId": "224000639"}'::jsonb
WHERE marker_key = 'tec_bus_stop';

-- 6. 논리적 하차지 stop들의 bus_stop_routes 제거
DELETE FROM bus_stop_routes WHERE bus_stop_id IN (14, 15, 16);

-- 6b. 논리적 하차지를 참조하는 map_marker_routes 제거
--     (inbound_stop_id가 하차지인 행: 등교 노선의 학교 도착 마커 연결)
DELETE FROM map_marker_routes WHERE inbound_stop_id IN (14, 15, 16);

-- 7. 논리적 하차지 stop 삭제
DELETE FROM bus_stops WHERE id IN (14, 15, 16);

-- 8. 검증 쿼리
SELECT 'bus_stops_count' AS check_name, COUNT(*)::text AS result FROM bus_stops
UNION ALL
SELECT 'bus_stop_routes_count', COUNT(*)::text FROM bus_stop_routes
UNION ALL
SELECT '3400_하교_timetable_at_stop3', COUNT(*)::text
  FROM bus_timetable_entries
  WHERE route_id = (SELECT id FROM bus_routes WHERE route_number='3400' AND category='하교')
    AND stop_id = 3
UNION ALL
SELECT '3400_하교_timetable_at_stop1_should_be_0', COUNT(*)::text
  FROM bus_timetable_entries
  WHERE route_id = (SELECT id FROM bus_routes WHERE route_number='3400' AND category='하교')
    AND stop_id = 1
UNION ALL
SELECT 'stops_14_15_16_should_be_0', COUNT(*)::text
  FROM bus_stops WHERE id IN (14, 15, 16)
UNION ALL
SELECT 'tec_bus_stop_ui_meta', ui_meta::text
  FROM map_markers WHERE marker_key='tec_bus_stop';

COMMIT;
