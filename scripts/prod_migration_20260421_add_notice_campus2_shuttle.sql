BEGIN;

INSERT INTO notices (title, content, is_active)
VALUES (
    '시흥시청역 -> 학교 방면 (등교)와 2캠 셔틀 시간표 추가.',
    '33번, 5602번, 3401번의 시흥시청 출발 -> 이마트/학교 방향 실시간 도착 정보 추가가 완료되었습니다.' || E'\n' ||
    '또한, 본캠 -> 2캠 혹은 정왕역 -> 2캠 버스 이용 시간표 정보가 추가되었습니다',
    TRUE
);

COMMIT;
