-- ============================================================
-- prod 직접 적용 마이그레이션 — 2026-06-26
-- 여름방학(정상근무-계절학기) 셔틀버스 시간표 추가
--   - schedule_periods.period_type CHECK 확장: + 'SEASONAL'
--   - schedule_periods 1건: '2026 여름 계절학기' (2026-06-24 ~ 2026-07-25, priority 100)
--   - shuttle_timetable_entries: 본교(direction 0·1) 평일 + 2캠(direction 2·3) 평일·토요일
-- 출처: https://www.tukorea.ac.kr/tukorea/1136/subview.do (셔틀버스 시간표 PDF)
-- 적용: psql "$DATABASE_URL" -f scripts/prod_migration_20260626_seasonal_shuttle.sql
-- 적용 후: Redis 'shuttle:period:*' / 'shuttle:entries:*' 키 삭제(또는 백엔드 재시작)로
--          방학 중 캐시된 'period 없음'을 무효화할 것.
-- 노선 id는 direction으로 조회(모델에 route_name 없음). 재실행 안전(엔트리 선삭제).
-- ============================================================

BEGIN;

-- 1) period_type CHECK 확장 (SEASONAL 추가)
ALTER TABLE schedule_periods DROP CONSTRAINT IF EXISTS schedule_periods_period_type_check;
ALTER TABLE schedule_periods
    ADD CONSTRAINT schedule_periods_period_type_check
    CHECK (period_type IN ('SEMESTER','VACATION','EXAM','HOLIDAY','SUSPENDED','SEASONAL'));

-- 2) 계절학기 period (겹치는 VACATION보다 우선하도록 priority 100)
INSERT INTO schedule_periods (period_type, name, start_date, end_date, priority, notice_message)
SELECT 'SEASONAL', '2026 여름 계절학기', DATE '2026-06-24', DATE '2026-07-25', 100,
       '계절학기 축소 운행 시간표입니다.'
WHERE NOT EXISTS (
    SELECT 1 FROM schedule_periods
    WHERE period_type = 'SEASONAL' AND start_date = DATE '2026-06-24'
);

-- 재실행 안전: 이 period의 기존 엔트리 제거 후 재삽입
DELETE FROM shuttle_timetable_entries
WHERE schedule_period_id = (
    SELECT id FROM schedule_periods
    WHERE period_type = 'SEASONAL' AND start_date = DATE '2026-06-24'
);

-- ────────────────────────────────────────────────────────────
-- 3) 본교 direction 1 = 하교 (학교 → 정왕역), 평일
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note)
SELECT p.id, r.id, 'weekday', v.dt, v.note
FROM (SELECT id FROM schedule_periods WHERE period_type='SEASONAL' AND start_date=DATE '2026-06-24') p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=1 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '09:10', NULL::varchar), (TIME '09:25', NULL), (TIME '09:50', NULL),
    (TIME '10:10', NULL), (TIME '10:25', NULL), (TIME '10:45', NULL),
    (TIME '11:00', NULL), (TIME '11:20', NULL), (TIME '11:40', NULL),
    (TIME '12:00', NULL), (TIME '12:20', NULL), (TIME '12:40', NULL),
    (TIME '13:00', NULL), (TIME '13:10', NULL), (TIME '13:25', NULL), (TIME '13:40', NULL),
    (TIME '14:00', NULL), (TIME '14:20', NULL), (TIME '14:40', NULL),
    (TIME '15:00', NULL), (TIME '15:20', NULL), (TIME '15:40', NULL),
    (TIME '16:00', NULL), (TIME '16:20', NULL), (TIME '16:40', NULL), (TIME '16:50', NULL),
    (TIME '17:00', NULL), (TIME '17:20', NULL), (TIME '17:40', NULL), (TIME '17:50', NULL),
    (TIME '18:00', NULL), (TIME '18:20', NULL), (TIME '18:40', NULL), (TIME '18:50', NULL),
    (TIME '19:05', NULL), (TIME '19:25', NULL), (TIME '19:45', NULL),
    (TIME '20:10', '막차')
) AS v(dt, note);

-- ────────────────────────────────────────────────────────────
-- 4) 본교 direction 0 = 등교 (정왕역 → 학교), 평일
--    16:50까지 정규 등교, 17시 이후는 하교 버스 회차편 탑승(파리바게뜨 건너편).
--    회차편 출발시각 = 학교 출발(하교) + 약 8분, 막차 19:53.
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note)
SELECT p.id, r.id, 'weekday', v.dt, v.note
FROM (SELECT id FROM schedule_periods WHERE period_type='SEASONAL' AND start_date=DATE '2026-06-24') p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=0 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '08:41', NULL::varchar), (TIME '08:59', NULL),
    (TIME '09:05', NULL), (TIME '09:15', NULL), (TIME '09:20', NULL), (TIME '09:35', NULL), (TIME '09:50', NULL),
    (TIME '10:00', NULL), (TIME '10:20', NULL), (TIME '10:35', NULL), (TIME '10:55', NULL),
    (TIME '11:10', NULL), (TIME '11:30', NULL), (TIME '11:50', NULL),
    (TIME '12:10', NULL), (TIME '12:30', NULL), (TIME '12:50', NULL),
    (TIME '13:10', NULL), (TIME '13:20', NULL), (TIME '13:35', NULL), (TIME '13:50', NULL),
    (TIME '14:10', NULL), (TIME '14:30', NULL), (TIME '14:50', NULL),
    (TIME '15:10', NULL), (TIME '15:30', NULL), (TIME '15:50', NULL),
    (TIME '16:10', NULL), (TIME '16:30', NULL), (TIME '16:50', NULL),
    -- 17시 이후 회차편 (파리바게뜨 건너편 탑승)
    (TIME '17:08', '회차편 · 학교 17:00 출발'),
    (TIME '17:28', '회차편 · 학교 17:20 출발'),
    (TIME '17:48', '회차편 · 학교 17:40 출발'),
    (TIME '17:58', '회차편 · 학교 17:50 출발'),
    (TIME '18:08', '회차편 · 학교 18:00 출발'),
    (TIME '18:28', '회차편 · 학교 18:20 출발'),
    (TIME '18:48', '회차편 · 학교 18:40 출발'),
    (TIME '18:58', '회차편 · 학교 18:50 출발'),
    (TIME '19:13', '회차편 · 학교 19:05 출발'),
    (TIME '19:33', '회차편 · 학교 19:25 출발'),
    (TIME '19:53', '회차편 · 학교 19:45 출발 (막차)')
) AS v(dt, note);

-- ────────────────────────────────────────────────────────────
-- 5) 2캠 direction 2 = 등교 (본교 → 제2캠퍼스), 평일
--    첫차는 정왕역 09:00 출발(서문 경유), 이후 본교 산융관 앞 출발.
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note)
SELECT p.id, r.id, 'weekday', v.dt, v.note
FROM (SELECT id FROM schedule_periods WHERE period_type='SEASONAL' AND start_date=DATE '2026-06-24') p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=2 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '09:00', '정왕역 09:00 출발 · 서문 경유'),
    (TIME '11:40', NULL),
    (TIME '14:50', NULL),
    (TIME '16:20', NULL),
    (TIME '17:20', NULL)
) AS v(dt, note);

-- ────────────────────────────────────────────────────────────
-- 6) 2캠 direction 3 = 하교 (제2캠퍼스 → 본교), 평일
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note)
SELECT p.id, r.id, 'weekday', v.dt, v.note
FROM (SELECT id FROM schedule_periods WHERE period_type='SEASONAL' AND start_date=DATE '2026-06-24') p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=3 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '09:35', NULL::varchar),
    (TIME '12:10', NULL),
    (TIME '15:10', NULL),
    (TIME '16:40', NULL),
    (TIME '17:40', '오이도역 도착')
) AS v(dt, note);

-- ────────────────────────────────────────────────────────────
-- 7) 2캠 direction 2 = 등교 (정왕역 꽃집앞 → 서문 → 제2캠퍼스), 토요일
--    ※ 일학습 수업용(6/27~7/25). day_type 한계로 '특정 토요일 한정 추가운행
--      (6/27·7/25의 08:45/08:55/09:05)'은 표현 불가 → 표준 토요일 시각만 시드.
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note)
SELECT p.id, r.id, 'saturday', v.dt, v.note
FROM (SELECT id FROM schedule_periods WHERE period_type='SEASONAL' AND start_date=DATE '2026-06-24') p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=2 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '08:40', '정왕역 꽃집앞 출발 · 서문 경유'),
    (TIME '08:50', '정왕역 꽃집앞 출발 · 서문 경유'),
    (TIME '09:00', '정왕역 꽃집앞 출발 · 서문 경유'),
    (TIME '09:10', '정왕역 꽃집앞 출발 · 서문 경유'),
    (TIME '09:15', '정왕역 꽃집앞 출발 · 서문 경유')
) AS v(dt, note);

-- ────────────────────────────────────────────────────────────
-- 8) 2캠 direction 3 = 하교 (제2캠퍼스 → 서문 → 정왕역), 토요일
--    16:20~16:45 5~8대 순차운행 → 대표값 16:20 시드.
-- ────────────────────────────────────────────────────────────
INSERT INTO shuttle_timetable_entries (schedule_period_id, shuttle_route_id, day_type, departure_time, note)
SELECT p.id, r.id, 'saturday', v.dt, v.note
FROM (SELECT id FROM schedule_periods WHERE period_type='SEASONAL' AND start_date=DATE '2026-06-24') p
CROSS JOIN (SELECT id FROM shuttle_routes WHERE direction=3 ORDER BY id LIMIT 1) r
CROSS JOIN (VALUES
    (TIME '16:20', '정왕역 종착 · 16:20~16:45 5~8대 순차운행')
) AS v(dt, note);

COMMIT;
