BEGIN;

-- bus_hub_jw_sihwa 마커(3400 정류장)에 99-2 노선 추가
-- 시흥터미널(stop_id=17)에 99-2도 정차하므로 지도 마커에 "3400 외 1대" 표시
INSERT INTO map_marker_routes (marker_id, route_number, route_color, badge_text, outbound_stop_id, inbound_stop_id, ui_meta, sort_order)
VALUES (5, '99-2', '#0891B2', NULL, 17, NULL, '{}', 10)
ON CONFLICT DO NOTHING;

COMMIT;
