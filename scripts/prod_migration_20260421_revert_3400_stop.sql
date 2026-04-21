BEGIN;

-- 3400 하교 시간표를 stop_id=3(한국공학대)에서 stop_id=1(시화터미널)로 되돌림
UPDATE bus_timetable_entries
SET stop_id = 1
WHERE route_id = (SELECT id FROM bus_routes WHERE route_number = '3400' AND category = '하교')
  AND stop_id = 3;

-- bus_stop_routes 연결도 되돌림
UPDATE bus_stop_routes
SET bus_stop_id = 1
WHERE bus_route_id = (SELECT id FROM bus_routes WHERE route_number = '3400' AND category = '하교')
  AND bus_stop_id = 3;

-- map_marker_routes outbound_stop_id도 되돌림
UPDATE map_marker_routes
SET outbound_stop_id = 1
WHERE route_number = '3400'
  AND outbound_stop_id = 3;

COMMIT;
