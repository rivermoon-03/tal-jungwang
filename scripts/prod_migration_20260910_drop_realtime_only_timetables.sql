-- 2026-09-10 실시간 전용 노선의 시간표 행을 마저 걷어낸다 (20-1, 시흥1)
--
-- 같은 날 prod_migration_20260910_drop_siheung33_timetable.sql 로 시흥33 을
-- 먼저 정리했다. 남은 두 노선도 같은 상태라 함께 끝낸다.
--
-- 이 값들의 출처는 이 앱 자신이다. 2026-04-20 공지가 그렇게 적어 뒀다.
--
--   "33번과 1번 등 시간표 없이 실시간 도착 정보를 기반으로 정보를 제공하는
--    버스들은 이전 도착 내역들을 시간표처럼 출력하게 하여 예측이 가능하도록
--    기능을 만들었습니다."
--
-- 세 노선이 같은 관측 창에서 나왔다는 것이 분 단위로 드러난다.
--
--   시흥33  60건  06:12 ~ 21:50  평일만
--   시흥1   92건  06:12 ~ 21:48  평일만
--   20-1    22건  06:12 ~ 21:48  평일만
--
-- 서로 다른 회사의 서로 다른 노선이 첫차와 막차를 분 단위로 공유할 수 없다.
-- 반면 실제 발행 시간표를 가진 노선은 범위도 제각각이고 평일·토·일 편성이
-- 모두 있다(3400 00:05~23:50, 5602 00:00~23:40, 6502 05:00~23:30).
--
-- 20-1 은 간격이 14분에서 130분까지 벌어진다. 발행 시간표에 두 시간 십 분짜리
-- 구멍이 있을 수 없다. 22건으로 하루를 덮으려 한 것 자체가 관측의 모양이다.
--
-- 앱의 정보 출처 모델도 두 노선에 시간표 출처를 두지 않는다(둘 다 realtime 만).
-- 상세 시트만 출처 모델을 거치지 않고 이 표를 직접 읽어, 유도한 값을 확정
-- 시각표처럼 보여주고 있었다.
--
-- 실시간은 그대로다. bus_realtime_targets 도 bus_information_sources 도
-- 건드리지 않는다. 두 노선 다 실시간 출처와 수집 대상이 각각 1건씩 살아 있어
-- 시간표를 지워도 화면이 비지 않는다.

BEGIN;

DELETE FROM bus_timetable_entries entry
USING bus_routes route
WHERE entry.route_id = route.id
  AND route.route_number IN ('20-1', '시흥1');

COMMIT;

-- ============================================================
-- 적용 후 검증
-- ============================================================
-- SELECT r.route_number, count(*)
--   FROM bus_routes r
--   LEFT JOIN bus_timetable_entries e ON e.route_id = r.id
--  WHERE r.route_number IN ('20-1', '시흥1', '시흥33')
--  GROUP BY r.route_number;
--   세 노선 모두 0 이어야 한다.
--
-- SELECT r.route_number, s.source_type, st.name
--   FROM bus_information_sources s
--   JOIN bus_commute_contexts c ON c.id = s.context_id
--   JOIN bus_routes r ON r.id = c.bus_route_id
--   JOIN bus_stops st ON st.id = s.bus_stop_id
--  WHERE r.route_number IN ('20-1', '시흥1')
--  ORDER BY r.route_number;
--   각각 realtime 한 줄씩 그대로 남는다.
--
-- SELECT r.route_number, count(*)
--   FROM bus_timetable_entries e
--   JOIN bus_routes r ON r.id = e.route_id
--  GROUP BY r.route_number ORDER BY 2 DESC;
--   3400, 3401, 5602, 6502 의 발행 시간표는 그대로 남아 있어야 한다.
