BEGIN;

-- 1. 99-2 하교 노선 추가
INSERT INTO bus_routes (route_number, route_name, direction_name, gbis_route_id, category)
VALUES ('99-2', '시흥99-2번', '월곶역방면', '224000034', '하교')
ON CONFLICT DO NOTHING;

-- 2. 시흥터미널 정류장 연결 (stop_id=17)
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id)
SELECT 17, id FROM bus_routes WHERE route_number = '99-2' AND category = '하교'
ON CONFLICT DO NOTHING;

-- 3. 이마트 정류장 연결 (stop_id=2)
INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id)
SELECT 2, id FROM bus_routes WHERE route_number = '99-2' AND category = '하교'
ON CONFLICT DO NOTHING;

COMMIT;
