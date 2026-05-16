BEGIN;

-- ±2h 윈도우 + 주말 묶음 전환: 기존 분위수 rows 모두 폐기 후 새 CHECK 적용.
-- 다음 refresh 잡(또는 수동 실행)에서 다시 채워짐.
TRUNCATE bus_arrival_stats;

ALTER TABLE bus_arrival_stats DROP CONSTRAINT IF EXISTS bus_arrival_stats_day_type_check;
ALTER TABLE bus_arrival_stats ADD CONSTRAINT bus_arrival_stats_day_type_check
  CHECK (day_type IN ('weekday','weekend'));

COMMIT;
