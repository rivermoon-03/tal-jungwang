-- 2026-09-09 실시간 관측점을 학생이 실제로 타는 정류장으로 옮긴다
--
-- 지금까지 3400·3401·5602 는 승차점이 아니라 하류에서 관측했고 6502 는 관측
-- 자체가 없었다. 하류 관측은 "내가 놓친 버스가 시흥시청에 언제 닿는지" 를
-- 알려 준다. 학생이 묻는 것은 "내 정류장에 언제 오는지" 다.
--
--   3400 하교 : 승차 시화터미널(224000861) / 관측 이마트(224000513)
--   3401 하교 : 승차 이마트(224000513)     / 관측 시흥시청 서울방향(224000538)
--   5602 하교 : 승차 이마트(224000513)     / 관측 시흥시청 서울방향(224000538)
--   6502 하교 : 승차 이마트(224000513)     / 관측 없음
--
-- 넷 다 경기도 면허 노선이고 승차점도 전부 경기도 정류소라 실시간이 나온다.
-- 실시간 부재는 데이터 한계가 아니라 등록의 문제였다.
--
-- API 호출은 늘지 않는다. 도착정보 조회는 stationId 하나로 그 정류소의 모든
-- 노선을 돌려주고(services/external/gbis.py), 수집기는 이미 224000861 과
-- 224000513 을 45초마다 부르고 있다(5200·99-2·시흥1 때문에). 등록되지 않은
-- 노선을 bus_collector.py 가 버리고 있었을 뿐이다.
--
-- 부수 효과 두 가지.
--   1. 시간표와 실시간이 같은 정류장에 놓이면서 "실시간, 부재 시 시간표" 폴백이
--      되살아난다. 지금은 그 조합이 DB 에 0건이라 프런트 폴백 코드가 도달
--      불가였다(SchedulePage.jsx fallbackTimetableSource).
--   2. bus_hub_jw_sihwa 마커가 3400 을 보여주게 된다. 마커가 조회하는 정류장은
--      시화터미널인데 거기 3400 은 실시간 대상도 시간표 행도 없어서, 이름이
--      "3400" 인 마커를 눌러도 99-2 한 줄만 나왔다.

BEGIN;

-- ============================================================
-- 1. 승차점 실시간 수집 대상 등록
-- ============================================================
INSERT INTO bus_realtime_targets (bus_route_id, bus_stop_id, travel_direction, enabled)
SELECT route.id, stop.id, seed.travel_direction, TRUE
FROM (VALUES
  ('3400', '224000861', 'to-seoul'),   -- 시화터미널 승차(기존 이마트 관측은 유지)
  ('3401', '224000513', 'to-seoul'),   -- 이마트 승차
  ('5602', '224000513', 'to-seoul'),
  ('6502', '224000513', 'to-seoul')
) AS seed(route_number, gbis_station_id, travel_direction)
JOIN bus_routes route
  ON route.route_number = seed.route_number AND route.category = '하교'
JOIN bus_stops stop ON stop.gbis_station_id = seed.gbis_station_id
ON CONFLICT (bus_route_id, bus_stop_id, travel_direction) DO UPDATE SET enabled = TRUE;

-- 하류 관측(시흥시청 서울방향)은 더 이상 쓰지 않는다. 화면에 닿는 경로가 없고
-- 이 정류장은 3401·5602 때문에만 폴링되고 있었다 — 사이클당 호출 하나가 준다.
UPDATE bus_realtime_targets target
SET enabled = FALSE
FROM bus_routes route, bus_stops stop
WHERE target.bus_route_id = route.id
  AND target.bus_stop_id = stop.id
  AND route.category = '하교'
  AND route.route_number IN ('3401', '5602')
  AND stop.gbis_station_id = '224000538';

-- ============================================================
-- 2. 화면에 쓰는 정보 출처를 승차점으로 교체
-- ============================================================
-- 하류 관측(downstream_arrival) 출처를 걷어낸다.
DELETE FROM bus_information_sources source
USING bus_commute_contexts context, bus_routes route
WHERE source.context_id = context.id
  AND context.bus_route_id = route.id
  AND route.category = '하교'
  AND route.route_number IN ('3401', '5602')
  AND source.source_type = 'realtime'
  AND source.source_role = 'downstream_arrival';

INSERT INTO bus_information_sources
  (context_id, source_type, source_role, bus_stop_id, display_label, travel_direction, sort_order)
SELECT context.id, 'realtime', 'boarding_arrival', stop.id,
       seed.display_label, 'to-seoul', seed.sort_order
FROM (VALUES
  ('3400', '224000861', '시화터미널 승차', 20),
  ('3400', '224000513', '이마트 승차',     30),
  ('3401', '224000513', '이마트 승차',     20),
  ('5602', '224000513', '이마트 승차',     20),
  ('6502', '224000513', '이마트 승차',     20)
) AS seed(route_number, gbis_station_id, display_label, sort_order)
JOIN bus_routes route
  ON route.route_number = seed.route_number AND route.category = '하교'
JOIN bus_commute_contexts context
  ON context.bus_route_id = route.id AND context.group_key = 'to-seoul'
JOIN bus_stops stop ON stop.gbis_station_id = seed.gbis_station_id
ON CONFLICT (context_id, source_type, source_role, bus_stop_id) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  travel_direction = EXCLUDED.travel_direction,
  sort_order = EXCLUDED.sort_order;

-- 3400 의 기존 이마트 관측 출처는 위 INSERT 가 sort_order 만 갱신한다.
-- 시화터미널(20) 이 이마트(30) 보다 앞이라 대표값은 승차 기점이 된다.

-- ============================================================
-- 3. 지도 마커 정리
-- ============================================================
-- 형제 마커는 전부 장소명(이마트·강남역·사당역)인데 이것만 노선번호였다.
UPDATE map_markers
   SET display_name = '시화터미널'
 WHERE marker_key = 'bus_hub_jw_sihwa'
   AND display_name = '3400';

-- 5200 은 노선과 정류장 연결만 추가되고 마커 연결이 빠져 지도에 안 떴다.
-- 같은 날 추가된 99-2 는 별도 마이그레이션으로 붙었다.
INSERT INTO map_marker_routes
  (marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order)
SELECT marker.id, '5200', '#DC2626', 'G', stop.id, NULL, '{}'::jsonb, 20
FROM map_markers marker
CROSS JOIN bus_stops stop
WHERE marker.marker_key = 'bus_hub_jw_sihwa'
  AND stop.gbis_station_id = '224000861'
  AND NOT EXISTS (
    SELECT 1 FROM map_marker_routes existing
     WHERE existing.marker_id = marker.id AND existing.route_number = '5200'
  );

-- 99-2 가 마커마다 다른 색과 배지를 달고 있었다. 같은 노선은 같게 그린다.
-- 값은 lineColor.js 의 --line-33(시내·마을) 계열로 맞춘다.
UPDATE map_marker_routes
   SET route_color = '#0891B2', badge_text = NULL
 WHERE route_number = '99-2';

-- 5602 는 목록에서 파랑(#2563EB) 인데 지도에서만 빨강이었다.
UPDATE map_marker_routes
   SET route_color = '#2563EB'
 WHERE route_number = '5602';

-- 강남역 마커의 3400 inbound 가 stop 1('시화', gbis id 없음) 을 가리켰다.
-- 2026-04 정류장 이동 때 outbound 만 옮기고 inbound 가 남은 잔재다.
UPDATE map_marker_routes
   SET inbound_stop_id = (SELECT id FROM bus_stops WHERE gbis_station_id = '224000861')
 WHERE route_number = '3400'
   AND inbound_stop_id = 1;

-- ============================================================
-- 4. 노선 행선지 정정
-- ============================================================
-- 20-1 의 정류장 140개 목록에 '아이파크아파트' 는 없다. 한국공학대(#137) 에서
-- 정왕역 방향으로 타면 이마트(#138) · 시흥세무서(#139) 다음이 정왕역(#140) 종점이다.
UPDATE bus_routes
   SET direction_name = '정왕역 방면'
 WHERE route_number = '20-1'
   AND category = '하교'
   AND direction_name = '아이파크아파트방면';

COMMIT;

-- ============================================================
-- 적용 후 검증
-- ============================================================
-- SELECT r.route_number, s.source_type, s.source_role, st.name, s.sort_order
--   FROM bus_information_sources s
--   JOIN bus_commute_contexts c ON c.id = s.context_id
--   JOIN bus_routes r ON r.id = c.bus_route_id
--   JOIN bus_stops st ON st.id = s.bus_stop_id
--  WHERE r.category = '하교' AND c.group_key = 'to-seoul'
--  ORDER BY r.route_number, s.sort_order;
--   3400 timetable 시화터미널 / realtime 시화터미널 / realtime 이마트
--   3401 timetable 이마트 / realtime 이마트
--   5602 timetable 이마트 / realtime 이마트
--   6502 timetable 이마트 / realtime 이마트
--
-- SELECT r.route_number, st.name, t.enabled
--   FROM bus_realtime_targets t
--   JOIN bus_routes r ON r.id = t.bus_route_id
--   JOIN bus_stops st ON st.id = t.bus_stop_id
--  WHERE r.category = '하교' AND r.route_number IN ('3400','3401','5602','6502')
--  ORDER BY r.route_number, st.name;
--   224000538 두 행만 enabled = false 여야 한다.
