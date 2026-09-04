-- 2026-09-04 하교 방면 탭 제거에 따른 중복 통학 컨텍스트 정리
--
-- 하교 화면은 이제 방면(정왕역/시흥시청/서울/월곶) 탭 없이 노선마다 경유지
-- (journey_labels)를 한 줄로 보여주는 단일 목록이다. 방면 탭이 있던 시절엔
-- 같은 버스가 여러 방면 탭에 각각 노출됐는데, 실제로는 그 여러 방면이
-- "어디서 내리느냐"만 다른 같은 운행 구간이었다.
--
-- 아래 세 쌍은 bus_information_sources(정류장·실시간/시간표 출처)가 완전히
-- 동일한데 group_key만 다른 진짜 중복이다(직접 조회로 확인함).
--   시흥33: to-jeongwang(학교→정왕역) 은 to-siheung-city-hall(학교→정왕역
--     →시흥시청역)의 앞부분과 같은 운행이다. 더 긴 쪽(시흥시청)을 남긴다.
--   3401:  to-siheung-city-hall(이마트→시흥시청역) 은 to-seoul(이마트→
--     시흥시청역→광명→석수역)의 앞부분과 같다. 더 긴 쪽(서울)을 남긴다.
--   5602:  to-siheung-city-hall(이마트→시흥시청역) 은 to-seoul(이마트→
--     시흥시청역→구로디지털단지역)의 앞부분과 같다. 더 긴 쪽(서울)을 남긴다.
--
-- 짧은 쪽(부분 여정) 컨텍스트를 지운다. journey_labels가 더 긴 쪽이 원래
-- 정보를 그대로 포함하므로 정보 손실이 없고, 화면에서 별도로 합칠 필요 없이
-- 지우는 쪽이 되돌리기도 더 쉽다(INSERT 한 번으로 복구 가능).
-- bus_information_sources는 bus_commute_contexts에 ON DELETE CASCADE로
-- 걸려 있어 컨텍스트를 지우면 그 출처 행도 함께 지워진다.

BEGIN;

DELETE FROM bus_commute_contexts context
USING bus_routes route
WHERE context.bus_route_id = route.id
  AND route.category = '하교'
  AND (
    (route.route_number = '시흥33' AND context.group_key = 'to-jeongwang') OR
    (route.route_number = '3401'   AND context.group_key = 'to-siheung-city-hall') OR
    (route.route_number = '5602'   AND context.group_key = 'to-siheung-city-hall')
  );

COMMIT;

-- ============================================================
-- 적용 후 검증
-- ============================================================
-- SELECT r.route_number, c.group_key, c.journey_labels
--   FROM bus_commute_contexts c JOIN bus_routes r ON r.id = c.bus_route_id
--  WHERE r.category = '하교'
--  ORDER BY r.route_number, c.group_key;
-- 시흥33/3401/5602 각각 하교에서 한 행씩만 남아야 한다.
