BEGIN;

-- 승객이 버스에 타는 지점은 시간표/실시간 방식과 무관하게 "승차"로 표시한다.
-- 이후 정류장의 도착 예정 정보(downstream_arrival)는 기존 "도착" 표현을 유지한다.
UPDATE bus_information_sources
SET display_label = regexp_replace(display_label, ' (출발|도착)$', ' 승차')
WHERE source_role IN ('departure', 'boarding_arrival')
  AND display_label ~ ' (출발|도착)$';

COMMIT;
