BEGIN;

-- 원본 bus_timetable_entries는 보존한다. 아래 DELETE는 화면에 노출할 수 있는
-- 정보 source 연결만 제거한다.
DELETE FROM bus_information_sources source
USING bus_commute_contexts context, bus_routes route
WHERE source.context_id = context.id
  AND context.bus_route_id = route.id
  AND route.category = '하교'
  AND route.route_number IN ('시흥1', '시흥33')
  AND source.source_type = 'timetable';

-- 시흥33 하교 시흥시청 방면은 시흥시청 도착값이 아니라 학교에서 타는 버스의
-- 도착 예정값을 보여준다. 잘못 연결된 실시간 source만 교체한다.
DELETE FROM bus_information_sources source
USING bus_commute_contexts context, bus_routes route
WHERE source.context_id = context.id
  AND context.bus_route_id = route.id
  AND route.category = '하교'
  AND route.route_number = '시흥33'
  AND context.group_key = 'to-siheung-city-hall'
  AND source.source_type = 'realtime';

INSERT INTO bus_commute_contexts
  (bus_route_id, group_key, origin_label, destination_label, journey_labels, sort_order)
SELECT route.id, 'to-wolgot', '시흥터미널·이마트', '월곶역',
       '["시흥터미널","이마트","월곶역"]'::jsonb, 10
FROM bus_routes route
WHERE route.route_number = '99-2' AND route.category = '하교'
ON CONFLICT (bus_route_id, group_key) DO UPDATE SET
  origin_label = EXCLUDED.origin_label,
  destination_label = EXCLUDED.destination_label,
  journey_labels = EXCLUDED.journey_labels,
  sort_order = EXCLUDED.sort_order;

INSERT INTO bus_information_sources
  (context_id, source_type, source_role, bus_stop_id, display_label, travel_direction, sort_order)
SELECT context.id, seed.source_type, seed.source_role, stop.id,
       seed.display_label, seed.travel_direction, seed.sort_order
FROM (VALUES
  ('시흥33','to-siheung-city-hall','realtime','boarding_arrival','224000639','한국공학대학교 도착','to-city-hall',10),
  ('99-2','to-wolgot','realtime','boarding_arrival','224000861','시흥터미널 도착','to-wolgot',10),
  ('99-2','to-wolgot','realtime','boarding_arrival','224000513','이마트 도착','to-wolgot',20)
) AS seed(route_number, group_key, source_type, source_role, gbis_station_id, display_label, travel_direction, sort_order)
JOIN bus_routes route
  ON route.route_number = seed.route_number AND route.category = '하교'
JOIN bus_commute_contexts context
  ON context.bus_route_id = route.id AND context.group_key = seed.group_key
JOIN bus_stops stop ON stop.gbis_station_id = seed.gbis_station_id
ON CONFLICT (context_id, source_type, source_role, bus_stop_id) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  travel_direction = EXCLUDED.travel_direction,
  sort_order = EXCLUDED.sort_order;

INSERT INTO bus_realtime_targets (bus_route_id, bus_stop_id, travel_direction, enabled)
SELECT route.id, stop.id, seed.travel_direction, TRUE
FROM (VALUES
  ('시흥33','224000639','to-city-hall'),
  ('99-2','224000861','to-wolgot'),
  ('99-2','224000513','to-wolgot')
) AS seed(route_number, gbis_station_id, travel_direction)
JOIN bus_routes route
  ON route.route_number = seed.route_number AND route.category = '하교'
JOIN bus_stops stop ON stop.gbis_station_id = seed.gbis_station_id
ON CONFLICT (bus_route_id, bus_stop_id, travel_direction) DO UPDATE SET enabled = TRUE;

-- 과거 seed에 있던 시흥33 하교 시흥시청 관측 target은 사용하지 않는다.
UPDATE bus_realtime_targets target
SET enabled = FALSE
FROM bus_routes route, bus_stops stop
WHERE target.bus_route_id = route.id
  AND target.bus_stop_id = stop.id
  AND route.route_number = '시흥33'
  AND route.category = '하교'
  AND stop.gbis_station_id = '224000586';

COMMIT;
