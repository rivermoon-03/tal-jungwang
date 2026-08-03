BEGIN;

-- 셔틀 마커 색을 코랄 #FF385C → 보라 #5b3aa8 로 교체.
--
-- #FF385C 는 폐기한 옛 앱 아이콘(네이비/코랄) 팔레트의 잔재다. 색 자체는 카테고리
-- 구분자로 멀쩡히 작동했지만 새 아이콘(teal)과 계보가 끊겨 정리한다.
--
-- #5b3aa8 은 DESIGN.md 카테고리 칩 팔레트의 --chip-purple 라이트 fg 값이라
-- 새로 만든 색이 아니다. 같은 지도에 뜨는 주황(수인분당 #F5A623)·초록(서해선
-- #75bf43)·시안(시흥33 #0891B2)·파랑(20-1 #2563EB) 과 구분되고, 브랜드 teal
-- (#12a594) 과도 겹치지 않는다 — DESIGN.md 상 accent 는 카테고리 구분에 쓰지 않는다.
-- 상태색(지연 #dc2626 / 임박 #f59e0b / 여유 #16a34a) 과도 충돌하지 않고,
-- 22x22 dot 위 흰 글자 대비는 약 7.2:1 이다.
--
-- 대상: map_markers id 1(등교) 2(하교) 13(제2 등교) 14(제2 하교) 15(꽃집앞 제2).
-- 옛 값을 조건에 걸어 두어 재실행해도 안전하다.
UPDATE map_markers
   SET ui_meta = jsonb_set(ui_meta, '{routeColor}', '"#5b3aa8"')
 WHERE marker_type = 'shuttle'
   AND ui_meta->>'routeColor' = '#FF385C';

COMMIT;
