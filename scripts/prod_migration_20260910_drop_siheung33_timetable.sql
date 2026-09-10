-- 2026-09-10 시흥33 의 시간표 행을 걷어낸다
--
-- 시흥33 은 발행 시간표가 없는 노선이다. GBIS 는 실시간만 준다.
--
-- 그런데 bus_timetable_entries 에 하교 평일 60건(id 764~823, 한국공학대학교)이
-- 정적으로 들어 있었다. 이 값의 출처는 이 앱 자신이다. 2026-04-20 공지가
-- 그렇게 적어 뒀다.
--
--   "33번과 1번 등 시간표 없이 실시간 도착 정보를 기반으로 정보를 제공하는
--    버스들은 이전 도착 내역들을 시간표처럼 출력하게 하여 예측이 가능하도록
--    기능을 만들었습니다."
--
-- 즉 4월에 관측한 도착 기록을 시간표 표에 굳혀 넣은 것이고, 그 뒤 다섯 달째
-- 갱신되지 않았다. 발행 시간표의 모양도 아니다 — 간격이 6, 8, 10, 12, 14, 16,
-- 18, 20, 28, 36, 40분으로 제각각이고 토요일과 일요일 편성이 없다. 같은 표에
-- 있는 실제 발행 시간표(route 6)는 규칙적이고 요일별 편성을 갖는다.
--
-- 앱의 정보 출처 모델도 이미 시흥33 에 시간표 출처를 두지 않는다. 상세 시트만
-- 출처 모델을 거치지 않고 이 표를 직접 읽어서, 유도한 값을 확정 시각표처럼
-- 보여주고 있었다.
--
-- 실시간은 그대로다. bus_realtime_targets 도 bus_information_sources 도
-- 건드리지 않는다. 이 노선은 이제 실시간만으로 답한다.
--
-- 남은 것: 시흥1(92행), 20-1(22행), 11-A(1행), 5200(2행), 99-2(2행)도 같은
-- 상태다. 시간표 출처가 없는데 시간표 행을 갖고 있다. 이번에는 33번만 걷어낸다.

BEGIN;

DELETE FROM bus_timetable_entries entry
USING bus_routes route
WHERE entry.route_id = route.id
  AND route.route_number = '시흥33';

COMMIT;

-- ============================================================
-- 적용 후 검증
-- ============================================================
-- SELECT count(*) FROM bus_timetable_entries e
--   JOIN bus_routes r ON r.id = e.route_id
--  WHERE r.route_number = '시흥33';
--   0 이어야 한다.
--
-- SELECT r.route_number, s.source_type, s.source_role, st.name
--   FROM bus_information_sources s
--   JOIN bus_commute_contexts c ON c.id = s.context_id
--   JOIN bus_routes r ON r.id = c.bus_route_id
--   JOIN bus_stops st ON st.id = s.bus_stop_id
--  WHERE r.route_number = '시흥33' ORDER BY r.category;
--   등교 realtime 시흥시청역 / 하교 realtime 한국공학대학교 두 줄이 그대로 남는다.
--
-- SELECT r.route_number, st.name, t.enabled
--   FROM bus_realtime_targets t
--   JOIN bus_routes r ON r.id = t.bus_route_id
--   JOIN bus_stops st ON st.id = t.bus_stop_id
--  WHERE r.route_number = '시흥33';
--   실시간 수집 대상은 건드리지 않는다.
