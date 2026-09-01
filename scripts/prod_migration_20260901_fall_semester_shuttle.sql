-- ============================================================
-- prod 직접 적용 마이그레이션 — 2026-09-01
-- 2026학년도 2학기 셔틀버스 시간표 반영
--
-- 배경: 마지막 운행 기간이 '여름방학 · 정상근무'(~2026-08-31)에서 끊겨 있어
--   9/1 개강일부터 GET /api/v1/shuttle/schedule 이 NO_SCHEDULE,
--   GET /api/v1/shuttle/next 가 NO_SHUTTLE 을 돌려주고 있었다.
--
-- 출처: https://www.tukorea.ac.kr/tukorea/1136/subview.do 의
--   '26년 셔틀버스 시간표 (2학기) 9.1 ~ 12.22.pdf' (2026-08-31 게시).
--   시각·정류장·비고가 1학기 PDF와 완전히 동일해서 period 1(2026학년도 1학기)과
--   같은 시간표를 그대로 쓴다. 단, 나중에 1학기 데이터를 손봐도 2학기가
--   딸려 흔들리지 않도록 참조가 아니라 값으로 다시 적는다.
--
-- 기간: SEMESTER '2026학년도 2학기' 2026-09-01 ~ 2026-12-22, priority 1.
--   여름방학 기간들(priority 110)과 날짜가 겹치지 않으므로 우선순위 경쟁 없음.
--
-- variant 는 전 구간 NULL — 학기 중에는 단축/정상근무 구분이 없다.
--
-- 등교 17시 이후는 하교 버스의 회차편 탑승(정왕역 파리바게뜨 건너편).
--   note 형식('회차편 · 학교 HH:MM 출발')은 프런트가 파싱하므로 바꾸지 말 것
--   (ScheduleDetailModal ShuttleContent).
--
-- 적용: psql "$DATABASE_URL" -f scripts/prod_migration_20260901_fall_semester_shuttle.sql
-- 적용 후: Redis 'shuttle:period:*' / 'shuttle:periods:*' / 'shuttle:entries:*' 삭제
--          (또는 백엔드 재시작 — invalidate_shuttle_cache 가 startup 에서 호출됨).
-- 재실행 안전: 기간은 WHERE NOT EXISTS, 엔트리는 선삭제 후 재삽입.
-- ============================================================

BEGIN;

-- 1) 2학기 운행 기간
INSERT INTO schedule_periods (period_type, name, start_date, end_date, priority, notice_message)
SELECT 'SEMESTER', '2026학년도 2학기', DATE '2026-09-01', DATE '2026-12-22', 1,
       '정왕역~본교 소요 약 10분 · 퇴근시간대 20~30분'
WHERE NOT EXISTS (
    SELECT 1 FROM schedule_periods sp WHERE sp.name = '2026학년도 2학기'
);

-- 재실행 안전: 기존 엔트리 제거 후 재삽입
DELETE FROM shuttle_timetable_entries
WHERE schedule_period_id IN (
    SELECT id FROM schedule_periods WHERE name = '2026학년도 2학기'
);

-- ────────────────────────────────────────────────────────────
-- A) 정왕역 → 본교 (direction 0, 등교) 평일
--    08:40~10:00 은 PDF 상 '수시운행' 구간이라 10분 간격으로 펼쳐 넣는다.
--    17시 이후는 하교 버스의 회차편(도착버스 탑승).
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, v.note, NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=0 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '08:40', '수시운행'::varchar), (TIME '08:50', '수시운행'), (TIME '09:00', '수시운행'),
    (TIME '09:10', '수시운행'), (TIME '09:20', '수시운행'), (TIME '09:30', '수시운행'),
    (TIME '09:40', '수시운행'), (TIME '09:50', '수시운행'), (TIME '10:00', '수시운행'),
    (TIME '10:10', NULL), (TIME '10:15', NULL), (TIME '10:20', NULL), (TIME '10:30', NULL), (TIME '10:50', NULL),
    (TIME '11:00', NULL), (TIME '11:10', NULL), (TIME '11:20', NULL), (TIME '11:30', NULL), (TIME '11:50', NULL),
    (TIME '12:00', NULL), (TIME '12:10', NULL), (TIME '12:20', NULL), (TIME '12:30', NULL), (TIME '12:50', NULL),
    (TIME '13:00', NULL), (TIME '13:10', NULL), (TIME '13:20', NULL), (TIME '13:30', NULL), (TIME '13:50', NULL),
    (TIME '14:00', NULL), (TIME '14:10', NULL), (TIME '14:20', NULL), (TIME '14:40', NULL),
    (TIME '15:00', NULL), (TIME '15:10', NULL), (TIME '15:20', NULL), (TIME '15:40', NULL),
    (TIME '16:00', NULL), (TIME '16:20', NULL), (TIME '16:30', NULL), (TIME '16:40', NULL), (TIME '16:50', NULL),
    (TIME '17:10', '회차편 · 학교 수시운행 출발'),
    (TIME '18:10', '회차편 · 학교 18:00 출발'), (TIME '18:20', '회차편 · 학교 18:10 출발'),
    (TIME '18:30', '회차편 · 학교 18:20 출발'), (TIME '18:40', '회차편 · 학교 18:30 출발'),
    (TIME '18:50', '회차편 · 학교 18:40 출발'), (TIME '19:00', '회차편 · 학교 18:50 출발'),
    (TIME '19:15', '회차편 · 학교 19:05 출발'), (TIME '19:25', '회차편 · 학교 19:15 출발'),
    (TIME '19:40', '회차편 · 학교 19:30 출발'), (TIME '19:55', '회차편 · 학교 19:45 출발'),
    (TIME '20:15', '회차편 · 학교 20:05 출발'), (TIME '20:35', '회차편 · 학교 20:25 출발'),
    (TIME '20:55', '회차편 · 학교 20:45 출발'),
    (TIME '21:10', '회차편 · 학교 21:00 출발'), (TIME '21:30', '회차편 · 학교 21:20 출발'),
    (TIME '21:58', '회차편 · 학교 21:48 출발'),
    (TIME '22:17', '막차')
) AS v(dt, note)
WHERE p.name = '2026학년도 2학기';

-- ────────────────────────────────────────────────────────────
-- B) 본교 → 정왕역 (direction 1, 하교) 평일
--    17:00~17:50 은 PDF 상 '수시운행' 구간.
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, v.note, NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=1 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '09:00', NULL::varchar), (TIME '09:20', NULL), (TIME '09:40', NULL),
    (TIME '10:00', NULL), (TIME '10:05', NULL), (TIME '10:10', NULL), (TIME '10:20', NULL),
    (TIME '10:40', NULL), (TIME '10:50', NULL),
    (TIME '11:00', NULL), (TIME '11:10', NULL), (TIME '11:20', NULL), (TIME '11:40', NULL), (TIME '11:50', NULL),
    (TIME '12:00', NULL), (TIME '12:10', NULL), (TIME '12:20', NULL), (TIME '12:40', NULL), (TIME '12:50', NULL),
    (TIME '13:00', NULL), (TIME '13:10', NULL), (TIME '13:20', NULL), (TIME '13:40', NULL), (TIME '13:50', NULL),
    (TIME '14:00', NULL), (TIME '14:10', NULL), (TIME '14:30', NULL), (TIME '14:50', NULL),
    (TIME '15:00', NULL), (TIME '15:10', NULL), (TIME '15:30', NULL), (TIME '15:50', NULL),
    (TIME '16:10', NULL), (TIME '16:20', NULL), (TIME '16:30', NULL), (TIME '16:40', NULL), (TIME '16:50', NULL),
    (TIME '17:00', '수시운행'), (TIME '17:10', '수시운행'), (TIME '17:20', '수시운행'),
    (TIME '17:30', '수시운행'), (TIME '17:40', '수시운행'), (TIME '17:50', '수시운행'),
    (TIME '18:00', NULL), (TIME '18:10', NULL), (TIME '18:20', NULL), (TIME '18:30', NULL),
    (TIME '18:40', NULL), (TIME '18:50', NULL),
    (TIME '19:05', NULL), (TIME '19:15', NULL), (TIME '19:30', NULL), (TIME '19:45', NULL),
    (TIME '20:05', NULL), (TIME '20:25', NULL), (TIME '20:45', NULL),
    (TIME '21:00', NULL), (TIME '21:20', NULL), (TIME '21:48', NULL),
    (TIME '22:10', NULL), (TIME '22:40', NULL)
) AS v(dt, note)
WHERE p.name = '2026학년도 2학기';

-- ────────────────────────────────────────────────────────────
-- C) 본교 → 제2캠퍼스 (direction 2) 평일
--    08:55·09:00 두 편은 정왕역에서 출발해 본교 서문을 경유한다.
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, v.note, NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=2 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '08:55', '정왕역 08:55 출발 (서문 경유)'::varchar),
    (TIME '09:00', '정왕역 09:00 출발 (서문 경유)'),
    (TIME '10:00', NULL), (TIME '11:00', NULL), (TIME '12:00', NULL), (TIME '13:00', NULL),
    (TIME '14:00', NULL), (TIME '15:00', NULL), (TIME '16:00', NULL), (TIME '17:00', NULL),
    (TIME '18:00', NULL), (TIME '19:00', NULL)
) AS v(dt, note)
WHERE p.name = '2026학년도 2학기';

-- ────────────────────────────────────────────────────────────
-- D) 제2캠퍼스 → 본교 (direction 3) 평일
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, v.note, NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=3 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '09:40', NULL::varchar), (TIME '10:30', NULL), (TIME '11:30', NULL), (TIME '12:30', NULL),
    (TIME '13:30', NULL), (TIME '14:30', NULL), (TIME '15:30', NULL), (TIME '16:30', NULL),
    (TIME '17:40', '오이도역 도착'),
    (TIME '18:30', NULL), (TIME '19:30', NULL)
) AS v(dt, note)
WHERE p.name = '2026학년도 2학기';

-- ────────────────────────────────────────────────────────────
-- E) 토요일 (일학습병행학부) — 정왕역⇒본교⇒2캠 / 2캠⇒본교⇒정왕역
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'saturday', v.dt, '정왕역 출발 (서문 경유)', NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=2 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '08:45'), (TIME '08:50'), (TIME '09:00'),
    (TIME '09:05'), (TIME '09:10'), (TIME '09:15')
) AS v(dt)
WHERE p.name = '2026학년도 2학기';

INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'saturday', v.dt, '정왕역 종착 (서문 경유)', NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=3 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '16:30'), (TIME '16:45'),
    (TIME '19:25'), (TIME '19:28'), (TIME '19:30'), (TIME '19:35'), (TIME '19:45')
) AS v(dt)
WHERE p.name = '2026학년도 2학기';

COMMIT;

-- 검증 (기대: weekday 144, saturday 13)
-- SELECT e.day_type, r.direction, count(*)
-- FROM shuttle_timetable_entries e
-- JOIN shuttle_routes r ON r.id = e.shuttle_route_id
-- JOIN schedule_periods p ON p.id = e.schedule_period_id
-- WHERE p.name = '2026학년도 2학기'
-- GROUP BY 1, 2 ORDER BY 1, 2;
