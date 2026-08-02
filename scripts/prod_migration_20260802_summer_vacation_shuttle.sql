-- ============================================================
-- prod 직접 적용 마이그레이션 — 2026-08-02
-- 여름방학 셔틀버스 시간표 전면 반영 (D1: 방학 셔틀 누락 해소)
--
-- 출처: https://www.tukorea.ac.kr/tukorea/1136/subview.do 셔틀버스 시간표 PDF.
--   1p는 색상 요약표(빨강=계절학기·초록=단축근무·검정=정상근무)이고
--   2~5p가 기간별로 전개된 상세 시간표다. 1p 요약표와 상세 페이지가 미묘하게
--   다른 곳(16:50 하교 유무, 시작일 6/23 vs 6/24)은 ★★ 날짜가 명시된
--   상세 페이지를 정본으로 삼았다.
--
-- 기간 구성 (상세 페이지 ★★ 표기 기준):
--   P1  SEASONAL  여름방학 · 계절학기(정상근무)  2026-06-24 ~ 2026-06-30  (2p)
--   P2  SEASONAL  여름방학 · 계절학기(단축근무)  2026-07-01 ~ 2026-07-13  (3p)
--   P3  VACATION  여름방학 · 단축근무            2026-07-14 ~ 2026-08-24  (4p)
--   P4  VACATION  여름방학 · 정상근무            2026-08-25 ~ 2026-08-31  (5p)
--
-- 스키마: shuttle_timetable_entries.variant 컬럼 추가.
--   seasonal=계절학기 | reduced=단축근무 | normal=정상근무 | NULL=기간 내 공통.
--   프런트가 이 값으로 시간표를 색상 분류해 렌더링한다.
--
-- 구버전 정리: 6/26 마이그레이션의 '2026 여름 계절학기'(6/24~7/25)는 이후
--   개정된 PDF와 기간·시각이 어긋나므로 통째로 대체한다(엔트리 CASCADE 삭제).
--
-- 2캠 토요일(일학습 6/27~7/25 수업용)은 P1·P2에만 시드한다. P3 범위 중
--   7/18·7/25 토요일도 운행이 있었지만 이미 지난 날짜이고, P3에 토요일을
--   넣으면 8월 토요일(미운행)에 오표시되므로 의도적으로 생략한다.
--
-- 등교 17시 이후는 하교 버스의 회차편 탑승(정왕역 파리바게뜨 건너편).
--   회차편 출발시각 = 학교 출발 + 약 8분, 막차 19:53 — 6/26 마이그레이션과
--   동일한 관례. note 형식('회차편 · 학교 HH:MM 출발')은 프런트가 파싱하므로
--   바꾸지 말 것 (ScheduleDetailModal ShuttleContent).
--
-- 적용: psql "$DATABASE_URL" -f scripts/prod_migration_20260802_summer_vacation_shuttle.sql
-- 적용 후: Redis 'shuttle:period:*' / 'shuttle:periods:*' / 'shuttle:entries:*' 삭제
--          (또는 백엔드 재시작 — invalidate_shuttle_cache가 startup에서 호출됨).
-- 재실행 안전: 기간은 WHERE NOT EXISTS, 엔트리는 선삭제 후 재삽입.
-- ============================================================

BEGIN;

-- 1) variant 컬럼 추가 (+ CHECK)
ALTER TABLE shuttle_timetable_entries ADD COLUMN IF NOT EXISTS variant VARCHAR(20);
ALTER TABLE shuttle_timetable_entries DROP CONSTRAINT IF EXISTS shuttle_tt_variant_check;
ALTER TABLE shuttle_timetable_entries
    ADD CONSTRAINT shuttle_tt_variant_check
    CHECK (variant IN ('seasonal', 'reduced', 'normal'));

-- 2) 구버전 계절학기 기간 제거 (개정 전 PDF 기준 데이터 — 엔트리 CASCADE 삭제)
DELETE FROM schedule_periods
WHERE period_type = 'SEASONAL' AND name = '2026 여름 계절학기';

-- 3) 여름방학 4개 기간 (겹치는 다른 기간보다 우선하도록 priority 110)
INSERT INTO schedule_periods (period_type, name, start_date, end_date, priority, notice_message)
SELECT v.ptype, v.pname, v.sd, v.ed, 110, '정왕역~본교 소요 약 10분 · 퇴근시간대 20~30분'
FROM (VALUES
    ('SEASONAL', '여름방학 · 계절학기(정상근무)', DATE '2026-06-24', DATE '2026-06-30'),
    ('SEASONAL', '여름방학 · 계절학기(단축근무)', DATE '2026-07-01', DATE '2026-07-13'),
    ('VACATION', '여름방학 · 단축근무',           DATE '2026-07-14', DATE '2026-08-24'),
    ('VACATION', '여름방학 · 정상근무',           DATE '2026-08-25', DATE '2026-08-31')
) AS v(ptype, pname, sd, ed)
WHERE NOT EXISTS (
    SELECT 1 FROM schedule_periods sp WHERE sp.name = v.pname
);

-- 재실행 안전: 위 4개 기간의 기존 엔트리 제거 후 재삽입
DELETE FROM shuttle_timetable_entries
WHERE schedule_period_id IN (
    SELECT id FROM schedule_periods
    WHERE name IN ('여름방학 · 계절학기(정상근무)', '여름방학 · 계절학기(단축근무)',
                   '여름방학 · 단축근무', '여름방학 · 정상근무')
);

-- ────────────────────────────────────────────────────────────
-- A) 본교 하교(direction 1) 평일 — 4개 기간 공통
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, v.note, NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=1 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '09:10', NULL::varchar), (TIME '09:25', NULL), (TIME '09:50', NULL),
    (TIME '10:10', NULL), (TIME '10:25', NULL), (TIME '10:45', NULL),
    (TIME '11:00', NULL), (TIME '11:20', NULL), (TIME '11:40', NULL),
    (TIME '12:00', NULL), (TIME '12:20', NULL), (TIME '12:40', NULL),
    (TIME '14:00', NULL), (TIME '14:20', NULL), (TIME '14:40', NULL),
    (TIME '19:05', NULL), (TIME '19:25', NULL), (TIME '19:45', NULL),
    (TIME '20:10', '막차')
) AS v(dt, note)
WHERE p.name IN ('여름방학 · 계절학기(정상근무)', '여름방학 · 계절학기(단축근무)',
                 '여름방학 · 단축근무', '여름방학 · 정상근무');

-- B) 본교 하교 13시 — 계절학기 증편 (P1·P2)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, NULL, 'seasonal'
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=1 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES (TIME '13:00'), (TIME '13:10'), (TIME '13:25'), (TIME '13:40')) AS v(dt)
WHERE p.name IN ('여름방학 · 계절학기(정상근무)', '여름방학 · 계절학기(단축근무)');

-- C) 본교 하교 13시 — 공통 3편 (P3·P4)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, NULL, NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=1 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES (TIME '13:00'), (TIME '13:20'), (TIME '13:40')) AS v(dt)
WHERE p.name IN ('여름방학 · 단축근무', '여름방학 · 정상근무');

-- D) 본교 하교 15~18시 — 단축근무 (P2·P3)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, NULL, 'reduced'
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=1 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '15:10'), (TIME '15:20'), (TIME '15:35'), (TIME '15:50'),
    (TIME '16:00'), (TIME '16:15'), (TIME '16:30'), (TIME '16:45'),
    (TIME '17:00'), (TIME '17:20'), (TIME '17:40'),
    (TIME '18:00'), (TIME '18:20'), (TIME '18:40')
) AS v(dt)
WHERE p.name IN ('여름방학 · 계절학기(단축근무)', '여름방학 · 단축근무');

-- E) 본교 하교 15~18시 — 정상근무 (P1 — 2p 기준, 16:50 포함)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, NULL, 'normal'
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=1 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '15:00'), (TIME '15:20'), (TIME '15:40'),
    (TIME '16:00'), (TIME '16:20'), (TIME '16:40'), (TIME '16:50'),
    (TIME '17:00'), (TIME '17:20'), (TIME '17:40'), (TIME '17:50'),
    (TIME '18:00'), (TIME '18:20'), (TIME '18:40'), (TIME '18:50')
) AS v(dt)
WHERE p.name = '여름방학 · 계절학기(정상근무)';

-- F) 본교 하교 15~18시 — 정상근무 (P4 — 5p 기준, 16:50 없음)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, NULL, 'normal'
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=1 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '15:00'), (TIME '15:20'), (TIME '15:40'),
    (TIME '16:00'), (TIME '16:20'), (TIME '16:40'),
    (TIME '17:00'), (TIME '17:20'), (TIME '17:40'), (TIME '17:50'),
    (TIME '18:00'), (TIME '18:20'), (TIME '18:40'), (TIME '18:50')
) AS v(dt)
WHERE p.name = '여름방학 · 정상근무';

-- ────────────────────────────────────────────────────────────
-- G) 본교 등교(direction 0) 평일 — 4개 기간 공통
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, NULL, NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=0 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '08:41'), (TIME '08:59'),
    (TIME '09:05'), (TIME '09:15'), (TIME '09:20'), (TIME '09:35'), (TIME '09:50'),
    (TIME '10:00'), (TIME '10:20'), (TIME '10:35'), (TIME '10:55'),
    (TIME '11:10'), (TIME '11:30'), (TIME '11:50'),
    (TIME '12:10'), (TIME '12:30'), (TIME '12:50'),
    (TIME '14:10'), (TIME '14:30'), (TIME '14:50')
) AS v(dt)
WHERE p.name IN ('여름방학 · 계절학기(정상근무)', '여름방학 · 계절학기(단축근무)',
                 '여름방학 · 단축근무', '여름방학 · 정상근무');

-- H) 본교 등교 13시 — 계절학기 증편 (P1·P2)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, NULL, 'seasonal'
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=0 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES (TIME '13:10'), (TIME '13:20'), (TIME '13:35'), (TIME '13:50')) AS v(dt)
WHERE p.name IN ('여름방학 · 계절학기(정상근무)', '여름방학 · 계절학기(단축근무)');

-- I) 본교 등교 13시 — 공통 3편 (P3·P4)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, NULL, NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=0 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES (TIME '13:10'), (TIME '13:30'), (TIME '13:50')) AS v(dt)
WHERE p.name IN ('여름방학 · 단축근무', '여름방학 · 정상근무');

-- J) 본교 등교 15~16시 — 단축근무 (P2·P3)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, NULL, 'reduced'
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=0 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '15:20'), (TIME '15:30'), (TIME '15:45'),
    (TIME '16:00'), (TIME '16:10'), (TIME '16:25'), (TIME '16:40'), (TIME '16:55')
) AS v(dt)
WHERE p.name IN ('여름방학 · 계절학기(단축근무)', '여름방학 · 단축근무');

-- K) 본교 등교 15~16시 — 정상근무 (P1·P4)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, NULL, 'normal'
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=0 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '15:10'), (TIME '15:30'), (TIME '15:50'),
    (TIME '16:10'), (TIME '16:30'), (TIME '16:50')
) AS v(dt)
WHERE p.name IN ('여름방학 · 계절학기(정상근무)', '여름방학 · 정상근무');

-- L) 본교 등교 회차편 19시대 — 4개 기간 공통 (하교 19:05/19:25/19:45 파생)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, v.note, NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=0 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '19:13', '회차편 · 학교 19:05 출발'),
    (TIME '19:33', '회차편 · 학교 19:25 출발'),
    (TIME '19:53', '회차편 · 학교 19:45 출발 (막차)')
) AS v(dt, note)
WHERE p.name IN ('여름방학 · 계절학기(정상근무)', '여름방학 · 계절학기(단축근무)',
                 '여름방학 · 단축근무', '여름방학 · 정상근무');

-- M) 본교 등교 회차편 17~18시 — 단축근무 (P2·P3)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, v.note, 'reduced'
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=0 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '17:08', '회차편 · 학교 17:00 출발'),
    (TIME '17:28', '회차편 · 학교 17:20 출발'),
    (TIME '17:48', '회차편 · 학교 17:40 출발'),
    (TIME '18:08', '회차편 · 학교 18:00 출발'),
    (TIME '18:28', '회차편 · 학교 18:20 출발'),
    (TIME '18:48', '회차편 · 학교 18:40 출발')
) AS v(dt, note)
WHERE p.name IN ('여름방학 · 계절학기(단축근무)', '여름방학 · 단축근무');

-- N) 본교 등교 회차편 17~18시 — 정상근무 (P1·P4, 17:50/18:50 회차 포함)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, v.note, 'normal'
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=0 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '17:08', '회차편 · 학교 17:00 출발'),
    (TIME '17:28', '회차편 · 학교 17:20 출발'),
    (TIME '17:48', '회차편 · 학교 17:40 출발'),
    (TIME '17:58', '회차편 · 학교 17:50 출발'),
    (TIME '18:08', '회차편 · 학교 18:00 출발'),
    (TIME '18:28', '회차편 · 학교 18:20 출발'),
    (TIME '18:48', '회차편 · 학교 18:40 출발'),
    (TIME '18:58', '회차편 · 학교 18:50 출발')
) AS v(dt, note)
WHERE p.name IN ('여름방학 · 계절학기(정상근무)', '여름방학 · 정상근무');

-- ────────────────────────────────────────────────────────────
-- O) 2캠 등교(direction 2) 평일 — 4개 기간 공통
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, v.note, NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=2 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '09:00', '정왕역 09:00 출발 · 서문 경유'),
    (TIME '11:40', NULL::varchar),
    (TIME '14:50', NULL),
    (TIME '16:20', NULL),
    (TIME '17:20', NULL)
) AS v(dt, note)
WHERE p.name IN ('여름방학 · 계절학기(정상근무)', '여름방학 · 계절학기(단축근무)',
                 '여름방학 · 단축근무', '여름방학 · 정상근무');

-- P) 2캠 하교(direction 3) 평일 — 4개 기간 공통
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'weekday', v.dt, v.note, NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=3 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '09:35', NULL::varchar),
    (TIME '12:10', NULL),
    (TIME '15:10', '정왕역 도착'),
    (TIME '16:40', NULL),
    (TIME '17:40', '오이도역 도착')
) AS v(dt, note)
WHERE p.name IN ('여름방학 · 계절학기(정상근무)', '여름방학 · 계절학기(단축근무)',
                 '여름방학 · 단축근무', '여름방학 · 정상근무');

-- Q) 2캠 등교 토요일 — 일학습 수업용, P1·P2만 (사유는 파일 머리말 참고)
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'saturday', v.dt, '정왕역 꽃집앞 출발 · 서문 경유', NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=2 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '08:40'), (TIME '08:50'), (TIME '09:00'), (TIME '09:10'), (TIME '09:15')
) AS v(dt)
WHERE p.name IN ('여름방학 · 계절학기(정상근무)', '여름방학 · 계절학기(단축근무)');

-- R) 2캠 하교 토요일 — P1·P2만
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note, variant)
SELECT p.id, r.id, 'saturday', TIME '16:20', '정왕역 종착 · 16:20~16:45 5~8대 순차운행', NULL
FROM schedule_periods p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=3 ORDER BY id LIMIT 1) r
WHERE p.name IN ('여름방학 · 계절학기(정상근무)', '여름방학 · 계절학기(단축근무)');

COMMIT;
