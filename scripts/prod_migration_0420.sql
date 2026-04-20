-- ============================================================
-- prod 직접 적용 마이그레이션 — 2026-04-20
-- DB 전면 개선: is_realtime 제거, UNIQUE/CHECK/Index/Trigger/컬럼 추가
-- 적용: psql "$DATABASE_URL" -f scripts/prod_migration_0420.sql
-- ============================================================

BEGIN;

-- 1. bus_routes: gbis_route_id UNIQUE 제거
ALTER TABLE bus_routes DROP CONSTRAINT IF EXISTS bus_routes_gbis_route_id_key;

-- 2. bus_routes: is_realtime 컬럼 제거
ALTER TABLE bus_routes DROP COLUMN IF EXISTS is_realtime;

-- 3. bus_routes: (route_number, category) UNIQUE 추가
ALTER TABLE bus_routes
    ADD CONSTRAINT uq_bus_routes_number_category UNIQUE (route_number, category);

-- 4. bus_routes: route_name 빈 문자열 → NULL 정리
UPDATE bus_routes SET route_name = NULL WHERE route_name = '';

-- 5. bus_routes: route_name CHECK 추가
ALTER TABLE bus_routes
    ADD CONSTRAINT chk_route_name_not_empty
    CHECK (route_name IS NULL OR length(route_name) > 0);

-- 6. bus_stop_routes: 역방향 인덱스
CREATE INDEX IF NOT EXISTS idx_bus_stop_routes_route ON bus_stop_routes (bus_route_id);

-- 7. schedule_periods: 날짜 범위 인덱스
CREATE INDEX IF NOT EXISTS idx_schedule_periods_dates ON schedule_periods (start_date, end_date);

-- 8. app_info: subway_last_refreshed_at 컬럼 추가
ALTER TABLE app_info
    ADD COLUMN IF NOT EXISTS subway_last_refreshed_at TIMESTAMPTZ;

-- 9. 11-A 노선 direction_name 업데이트
UPDATE bus_routes SET direction_name = '정왕역방면' WHERE route_number = '11-A';

-- 10. notices: updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notices_updated_at ON notices;
CREATE TRIGGER trg_notices_updated_at
BEFORE UPDATE ON notices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 11. 서해선 지하철역 마커 ui_meta 채우기 (초지·시흥시청)
UPDATE map_markers
SET ui_meta = '{"tabId": "choji", "routeCode": "서해선", "routeColor": "#75bf43", "badgeText": "서해", "showLive": true}'::jsonb
WHERE marker_key = 'choji_station';

UPDATE map_markers
SET ui_meta = '{"tabId": "siheung", "routeCode": "서해선", "routeColor": "#75bf43", "badgeText": "서해", "showLive": true}'::jsonb
WHERE marker_key = 'siheung_station';

COMMIT;

-- ============================================================
-- 적용 후 검증 쿼리
-- ============================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'bus_routes' ORDER BY ordinal_position;
-- SELECT constraint_name, constraint_type FROM information_schema.table_constraints
--   WHERE table_name = 'bus_routes';
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'app_info';
-- SELECT trigger_name FROM information_schema.triggers
--   WHERE event_object_table = 'notices';
