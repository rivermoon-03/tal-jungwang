-- 2026-06-24 시간표 조회 인덱스 추가
--
-- 버스: 정류장 단위 도착 조회가 (stop_id, day_type, departure_time) 순으로 도는데
--       기존 idx_bus_tt_route_stop_day는 route_id가 선두라 정류장 조회에서 효율이 낮았다.
-- 지하철: 주 조회가 day_type 필터 + departure_time 정렬인데
--       기존 idx_subway_tt_dir_day는 direction이 선두라 풀스캔 + filesort가 났다.
--
-- 멱등 적용. 롤백: DROP INDEX idx_bus_tt_stop_day, idx_subway_tt_day;

CREATE INDEX IF NOT EXISTS idx_bus_tt_stop_day
    ON bus_timetable_entries (stop_id, day_type, departure_time);

CREATE INDEX IF NOT EXISTS idx_subway_tt_day
    ON subway_timetable_entries (day_type, departure_time);
