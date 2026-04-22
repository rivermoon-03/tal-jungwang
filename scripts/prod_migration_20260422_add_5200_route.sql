BEGIN;

-- 5200 하교 노선 추가. gbis_route_id=224000052, 시화터미널(17)+이마트(2) 양쪽 정류장.
INSERT INTO bus_routes (route_number, route_name, direction_name, gbis_route_id, category)
VALUES ('5200', '시흥5200번', '신도림역방면', '224000052', '하교')
ON CONFLICT DO NOTHING;

INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id)
  SELECT 17, id FROM bus_routes WHERE route_number = '5200' AND category = '하교'
  ON CONFLICT DO NOTHING;

INSERT INTO bus_stop_routes (bus_stop_id, bus_route_id)
  SELECT 2, id FROM bus_routes WHERE route_number = '5200' AND category = '하교'
  ON CONFLICT DO NOTHING;

COMMIT;
