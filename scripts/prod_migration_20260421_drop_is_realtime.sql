-- bus_routes.is_realtime 컬럼 제거
-- 모델이 @property로 gbis_route_id IS NOT NULL 계산하므로 DB 컬럼 불필요
BEGIN;

ALTER TABLE bus_routes
    DROP COLUMN IF EXISTS is_realtime;

COMMIT;
