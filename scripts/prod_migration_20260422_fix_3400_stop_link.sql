BEGIN;

-- 3400 하교 arrivals를 본캠(한국공학대 224000639, stop_id=3) 패널에 다시 표시하기 위해
-- bus_stop_routes와 timetable을 stop 3으로 복원한다.
-- map_marker_routes outbound_stop_id=17은 유지(지도 마커 물리 정류장 참조).

UPDATE bus_stop_routes
SET bus_stop_id = 3
WHERE bus_route_id = (SELECT id FROM bus_routes WHERE route_number = '3400' AND category = '하교')
  AND bus_stop_id = 17;

UPDATE bus_timetable_entries
SET stop_id = 3
WHERE route_id = (SELECT id FROM bus_routes WHERE route_number = '3400' AND category = '하교')
  AND stop_id = 17;

COMMIT;
