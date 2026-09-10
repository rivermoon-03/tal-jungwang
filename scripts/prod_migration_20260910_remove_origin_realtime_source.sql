-- 2026-09-10 3400 기점의 실시간 출처를 걷어낸다
--
-- 3400 의 기점은 시흥터미널(bus_stops.id=17, GBIS 224000861)이다.
-- prod_migration_20260909_realtime_at_boarding_stops.sql 이 그 정류장을 3400
-- 하교의 실시간 정보 출처로 등록했는데 이것이 잘못이었다.
--
-- 08:50:57 실측에서 GBIS 는 그 정류장의 3400 에 대해 arrive_in_seconds 681(09:02),
-- 2317(09:29) 을 내려주는데 location_no 가 각각 6, 17 이다. 아직 6정거장, 17정거장
-- 떨어져 들어오고 있는 차다. 기점에서 출발을 기다리며 서 있는 차가 아니다.
-- 그래서 이 숫자는 "언제 출발하나" 가 아니라 "다음 차가 터미널에 들어오나" 를
-- 뜻한다. 기점에서 학생에게 필요한 것은 출발 시각이고 그것은 시간표다
-- (평일 08:00, 08:30, 09:00, 09:30, 10:00).
--
-- bus_realtime_targets 는 건드리지 않는다. 그 정류장은 5200 과 99-2 때문에 어차피
-- 폴링되고 있어 대상을 지워도 API 호출이 줄지 않는다. 도착정보 조회는 stationId
-- 하나로 그 정류소의 모든 노선을 돌려준다(services/external/gbis.py).
--
-- 3400 의 이마트 승차 출처(sort_order 30)는 그대로 둔다. 하류가 아니라 승차점이고
-- 거기서는 실시간이 "내 정류장에 언제 오는지" 에 답한다.

BEGIN;

DELETE FROM bus_information_sources source
USING bus_commute_contexts context, bus_routes route, bus_stops stop
WHERE source.context_id = context.id
  AND context.bus_route_id = route.id
  AND source.bus_stop_id = stop.id
  AND route.route_number = '3400'
  AND route.category = '하교'
  AND source.source_type = 'realtime'
  AND stop.gbis_station_id = '224000861';

COMMIT;

-- ============================================================
-- 적용 후 검증
-- ============================================================
-- SELECT r.route_number, s.source_type, s.source_role, st.name, s.sort_order
--   FROM bus_information_sources s
--   JOIN bus_commute_contexts c ON c.id = s.context_id
--   JOIN bus_routes r ON r.id = c.bus_route_id
--   JOIN bus_stops st ON st.id = s.bus_stop_id
--  WHERE r.route_number = '3400' AND r.category = '하교'
--  ORDER BY s.sort_order;
--   timetable departure 시흥터미널 10 / realtime boarding_arrival 이마트 30 두 줄만 남는다.
--
-- SELECT count(*)
--   FROM bus_information_sources s
--   JOIN bus_commute_contexts c ON c.id = s.context_id
--   JOIN bus_routes r ON r.id = c.bus_route_id
--   JOIN bus_stops st ON st.id = s.bus_stop_id
--  WHERE r.route_number = '3400' AND r.category = '하교'
--    AND s.source_type = 'realtime' AND st.gbis_station_id = '224000861';
--   0 이어야 한다.
--
-- SELECT r.route_number, st.gbis_station_id, t.enabled
--   FROM bus_realtime_targets t
--   JOIN bus_routes r ON r.id = t.bus_route_id
--   JOIN bus_stops st ON st.id = t.bus_stop_id
--  WHERE st.gbis_station_id = '224000861'
--  ORDER BY r.route_number;
--   3400 행이 enabled = true 로 남아 있어야 한다. 이 마이그레이션은 이 표를 건드리지 않는다.
