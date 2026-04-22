BEGIN;

-- 3400 하교 노선을 한국공학대학교(stop_id=3) → 시흥터미널(stop_id=17)로 이동.
-- 실제 출발 정류장이 시화터미널(gbis=224000861)이므로 시화터미널 pill에 표시해야 함.

-- 1. bus_stop_routes 이동
UPDATE bus_stop_routes
SET bus_stop_id = 17
WHERE bus_route_id = (SELECT id FROM bus_routes WHERE route_number = '3400' AND category = '하교')
  AND bus_stop_id = 3;

-- 2. bus_timetable_entries 이동
UPDATE bus_timetable_entries
SET stop_id = 17
WHERE route_id = (SELECT id FROM bus_routes WHERE route_number = '3400' AND category = '하교')
  AND stop_id = 3;

COMMIT;
