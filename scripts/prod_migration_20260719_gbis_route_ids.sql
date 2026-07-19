-- prod_migration_20260719_gbis_route_ids.sql
-- 서울행 광역노선의 gbis_route_id NULL을 실측값으로 채워 실시간 도착 대상에 편입한다.
-- 노선 ID는 2026-07-19 GBIS getBusRouteListv2 실측으로 확인했다:
--   3400 = 224000050 (서울,시흥 직행좌석)
--   6502 = 224000061 (서울,시흥 직행좌석)
--   3401 = 224000071 (광명,서울,시흥 직행좌석) -- 기존 등교 행(224000071)과 일치
--   5602 = 216000047 (서울,시흥,안산,안양 일반형) -- 기존 등교 행(216000047)과 일치
-- IS NULL 가드로 이미 값이 있는 행은 건드리지 않는다. 롤백은 해당 행 gbis_route_id를 NULL로 되돌리면 된다.

BEGIN;

UPDATE bus_routes SET gbis_route_id = '224000050'
WHERE route_number = '3400' AND gbis_route_id IS NULL;

UPDATE bus_routes SET gbis_route_id = '224000061'
WHERE route_number = '6502' AND gbis_route_id IS NULL;

UPDATE bus_routes SET gbis_route_id = '224000071'
WHERE route_number = '3401' AND gbis_route_id IS NULL;

UPDATE bus_routes SET gbis_route_id = '216000047'
WHERE route_number = '5602' AND gbis_route_id IS NULL;

-- 검증: NULL이 남은 서울행 광역 행이 없어야 한다
DO $$
DECLARE remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining FROM bus_routes
  WHERE route_number IN ('3400', '6502', '3401', '5602') AND gbis_route_id IS NULL;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'gbis_route_id NULL 행이 %건 남음', remaining;
  END IF;
END $$;

COMMIT;
