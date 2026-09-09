-- 2026-09-10 같은 정류장을 두 이름으로 부르던 것 정정
--
-- 3400 카드 한 장에 "시흥터미널" 과 "시화터미널" 이 함께 떴다. 둘 다 같은
-- 정류장(id 17, GBIS 224000861)을 가리킨다.
--
-- 공식 정류소명은 "한국공학대학교.시흥터미널" 이다(경기버스정보 정류소 25854,
-- 3400 기점). 짧게 부를 때는 "시흥터미널" 이 맞고 "시화터미널" 은 틀렸다.
-- 2026-09-09 마이그레이션이 마커 이름과 새 출처 라벨에 틀린 쪽을 심었다.
--
-- bus_stops.name 자체도 원래 "시화터미널" 이었다. 화면 여러 곳이 이 값을 그대로
-- 쓰므로 여기서 함께 고친다.

BEGIN;

UPDATE bus_stops
   SET name = '시흥터미널'
 WHERE gbis_station_id = '224000861'
   AND name = '시화터미널';

UPDATE bus_information_sources
   SET display_label = '시흥터미널 승차'
 WHERE display_label = '시화터미널 승차';

UPDATE map_markers
   SET display_name = '시흥터미널'
 WHERE marker_key = 'bus_hub_jw_sihwa'
   AND display_name = '시화터미널';

COMMIT;

-- 적용 후 검증
-- SELECT id, name, gbis_station_id FROM bus_stops WHERE gbis_station_id = '224000861';
--   17 | 시흥터미널 | 224000861
-- SELECT DISTINCT display_label FROM bus_information_sources WHERE display_label LIKE '%터미널%';
--   시흥터미널 승차 한 줄만 나와야 한다.
