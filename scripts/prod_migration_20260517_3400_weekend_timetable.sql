-- 3400번 등교(학교행) 주말/휴일 시간표 추가
-- route_id=8 (3400 등교), stop_id=6 (강남역)
-- 출처: 2022.3.10 ~ 3400번 시화↔강남 주·휴일 시간표 (강남역 출발 시각)
-- 사용자 주의: 광역 3400 주말 시간표는 실제 운행과 차이가 있을 수 있어
--              프론트엔드에 안내 배너를 함께 표시한다.

BEGIN;

-- 기존 데이터 보존 가드: route_id=8, stop_id=6, day_type IN ('saturday','sunday') 이미 있으면 중복 방지
DELETE FROM bus_timetable_entries
 WHERE route_id = 8 AND stop_id = 6 AND day_type IN ('saturday', 'sunday');

-- 강남역 출발 시각 (주·휴일 공통, 34개) — saturday
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time) VALUES
  (8, 6, 'saturday', '00:05'),
  (8, 6, 'saturday', '00:30'),
  (8, 6, 'saturday', '06:55'),
  (8, 6, 'saturday', '07:35'),
  (8, 6, 'saturday', '08:10'),
  (8, 6, 'saturday', '08:40'),
  (8, 6, 'saturday', '09:10'),
  (8, 6, 'saturday', '09:40'),
  (8, 6, 'saturday', '10:05'),
  (8, 6, 'saturday', '10:30'),
  (8, 6, 'saturday', '11:00'),
  (8, 6, 'saturday', '11:35'),
  (8, 6, 'saturday', '12:10'),
  (8, 6, 'saturday', '12:45'),
  (8, 6, 'saturday', '13:20'),
  (8, 6, 'saturday', '13:55'),
  (8, 6, 'saturday', '14:30'),
  (8, 6, 'saturday', '15:10'),
  (8, 6, 'saturday', '15:50'),
  (8, 6, 'saturday', '16:30'),
  (8, 6, 'saturday', '17:05'),
  (8, 6, 'saturday', '17:40'),
  (8, 6, 'saturday', '18:10'),
  (8, 6, 'saturday', '18:40'),
  (8, 6, 'saturday', '19:10'),
  (8, 6, 'saturday', '19:40'),
  (8, 6, 'saturday', '20:10'),
  (8, 6, 'saturday', '20:35'),
  (8, 6, 'saturday', '21:05'),
  (8, 6, 'saturday', '21:35'),
  (8, 6, 'saturday', '22:05'),
  (8, 6, 'saturday', '22:35'),
  (8, 6, 'saturday', '23:05'),
  (8, 6, 'saturday', '23:35');

-- 강남역 출발 시각 (주·휴일 공통, 34개) — sunday
INSERT INTO bus_timetable_entries (route_id, stop_id, day_type, departure_time) VALUES
  (8, 6, 'sunday', '00:05'),
  (8, 6, 'sunday', '00:30'),
  (8, 6, 'sunday', '06:55'),
  (8, 6, 'sunday', '07:35'),
  (8, 6, 'sunday', '08:10'),
  (8, 6, 'sunday', '08:40'),
  (8, 6, 'sunday', '09:10'),
  (8, 6, 'sunday', '09:40'),
  (8, 6, 'sunday', '10:05'),
  (8, 6, 'sunday', '10:30'),
  (8, 6, 'sunday', '11:00'),
  (8, 6, 'sunday', '11:35'),
  (8, 6, 'sunday', '12:10'),
  (8, 6, 'sunday', '12:45'),
  (8, 6, 'sunday', '13:20'),
  (8, 6, 'sunday', '13:55'),
  (8, 6, 'sunday', '14:30'),
  (8, 6, 'sunday', '15:10'),
  (8, 6, 'sunday', '15:50'),
  (8, 6, 'sunday', '16:30'),
  (8, 6, 'sunday', '17:05'),
  (8, 6, 'sunday', '17:40'),
  (8, 6, 'sunday', '18:10'),
  (8, 6, 'sunday', '18:40'),
  (8, 6, 'sunday', '19:10'),
  (8, 6, 'sunday', '19:40'),
  (8, 6, 'sunday', '20:10'),
  (8, 6, 'sunday', '20:35'),
  (8, 6, 'sunday', '21:05'),
  (8, 6, 'sunday', '21:35'),
  (8, 6, 'sunday', '22:05'),
  (8, 6, 'sunday', '22:35'),
  (8, 6, 'sunday', '23:05'),
  (8, 6, 'sunday', '23:35');

-- 검증: 추가된 건수
DO $$
DECLARE
    sat_cnt int;
    sun_cnt int;
BEGIN
    SELECT COUNT(*) INTO sat_cnt FROM bus_timetable_entries
      WHERE route_id = 8 AND stop_id = 6 AND day_type = 'saturday';
    SELECT COUNT(*) INTO sun_cnt FROM bus_timetable_entries
      WHERE route_id = 8 AND stop_id = 6 AND day_type = 'sunday';
    IF sat_cnt <> 34 OR sun_cnt <> 34 THEN
        RAISE EXCEPTION '예상치 불일치: saturday=%, sunday=% (각 34이어야 함)', sat_cnt, sun_cnt;
    END IF;
    RAISE NOTICE '검증 통과 — saturday=%, sunday=%', sat_cnt, sun_cnt;
END $$;

COMMIT;
