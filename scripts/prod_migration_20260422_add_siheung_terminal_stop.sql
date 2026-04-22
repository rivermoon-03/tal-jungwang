BEGIN;

-- 1. 새 정류장: 한국공학대학교 시흥터미널 (GBIS stationId=224000861)
INSERT INTO bus_stops (name, gbis_station_id, lat, lng, sub_name)
VALUES ('한국공학대학교 시흥터미널', '224000861', 37.3424667, 126.7351167, NULL)
ON CONFLICT (gbis_station_id) DO NOTHING;

-- 2. bus_stop_routes: 3400 하교를 시화(id=1) → 새 정류장으로 교체
UPDATE bus_stop_routes
SET bus_stop_id = (SELECT id FROM bus_stops WHERE gbis_station_id = '224000861')
WHERE bus_route_id = (SELECT id FROM bus_routes WHERE route_number = '3400' AND category = '하교')
  AND bus_stop_id = 1;

-- 3. bus_timetable_entries: 3400 하교 시간표 stop_id를 새 정류장으로 변경
UPDATE bus_timetable_entries
SET stop_id = (SELECT id FROM bus_stops WHERE gbis_station_id = '224000861')
WHERE route_id = (SELECT id FROM bus_routes WHERE route_number = '3400' AND category = '하교')
  AND stop_id = 1;

-- 4. map_marker_routes: 3400 마커의 outbound_stop_id를 새 정류장으로 변경
UPDATE map_marker_routes
SET outbound_stop_id = (SELECT id FROM bus_stops WHERE gbis_station_id = '224000861')
WHERE route_number = '3400'
  AND outbound_stop_id = 1;

COMMIT;
