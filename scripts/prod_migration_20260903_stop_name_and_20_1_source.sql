-- 2026-09-03 정류장 이름 통일과 20-1 정보 출처 정리
--
-- 정류장 17
--   같은 장소를 두 이름으로 불렀다. 프론트의 busStationConfig.js 는 id 17 을
--   "시화터미널" 로 부르는데 DB name 은 "한국공학대학교 시흥터미널" 이었다.
--   그래서 3400 상세에서 머리말은 "시화터미널 기준", 실시간 블록은
--   "한국공학대학교 시흥터미널 기준" 으로 갈려 다른 정류장처럼 보였다.
--   코드가 정류장을 이름으로 매칭하는 곳은 없고 gbis_station_id 로만 잇는다.
--   그래서 표시 이름만 통일한다.
--
-- 20-1 시간표 출처
--   시간표 데이터 자체는 있지만 이 노선은 실시간만 보여주기로 했다.
--   시간표 행은 지우지 않고 노출 출처에서만 뺀다. 나중에 다시 쓸 수 있다.

BEGIN;

UPDATE bus_stops
   SET name = '시화터미널'
 WHERE gbis_station_id = '224000861'
   AND name <> '시화터미널';

DELETE FROM bus_information_sources s
 USING bus_commute_contexts c, bus_routes r
 WHERE s.context_id = c.id
   AND c.bus_route_id = r.id
   AND r.route_number = '20-1'
   AND s.source_type = 'timetable';

COMMIT;
