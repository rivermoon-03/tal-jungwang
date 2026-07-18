-- 2026-07-18 "학사공지" 탭 — department_notices / academic_calendar 테이블 신설
--
-- 배경: "더보기" 탭이 [학사공지] [설정&앱공지] 두 세그먼트로 재구성된다.
-- "학사공지"는 (1) 학과별 공지(컴퓨터공학부 RSS) 목록과 (2) 학사일정 D-day
-- 배너/예정목록을 보여준다.
--
-- 법적/윤리 검토(www.tukorea.ac.kr/robots.txt):
--   Allow: /bbs/ce/201/*  ← 컴퓨터공학부 게시판 RSS. 이것만 사용한다.
--   Disallow: /bbs/       ← 그 외 게시판(전교 학사공지 /bbs/tukorea/107 포함) 절대 스크래핑 금지.
--   /haksa/3000/subview.do(학사일정)는 Disallow 목록에 없고 정적 HTML 테이블.
--
-- department_notices: 본문은 저장하지 않는다(제목+게시일+원문링크만) —
--   저작권 리스크 최소화 + 원 사이트로 트래픽 유도.
--   (department, external_id) UNIQUE로 RSS 재수집 시 중복 삽입 방지.
--   external_id는 원문 게시글 번호(RSS link의 숫자, 예: 151703).
--
-- academic_calendar: 학교 사이트가 스크레이핑마다 현재 시점 기준 전체 목록을
--   권위 있는 스냅샷으로 제공하므로 (title, start_date, end_date) UNIQUE +
--   ON CONFLICT DO NOTHING으로 append-only 누적한다(삭제 로직 없음 —
--   스크레이핑 실패/일부 누락이 기존 데이터를 지우지 않는 그래스풀 디그레이데이션).
--
-- 백엔드가 채우는 캐시(TTL): school:notices:{dept} 120분 / school:calendar 25시간.
-- 갱신 크론: 학과 공지 60분 주기, 학사일정 매일 03:50 KST(로그 정리 03:45 다음 슬롯,
-- GBIS 폴링 휴식 02~04시 구간 안쪽이라 운영 트래픽과 겹치지 않음).
--
-- 적용 순서(운영 DB, 수동 실행):
--   1. 아래 CREATE TABLE + INDEX 실행.
--   2. 백엔드 재배포(스케줄러가 신규 크론 2개를 등록한다).
--   3. 첫 크론 실행 전까지는 두 테이블 모두 빈 상태 — API가 빈 배열/next=null을
--      정상 반환하는지 확인(프론트 방어 로직과 별개로 500이 나지 않아야 함).

CREATE TABLE IF NOT EXISTS department_notices (
    id              SERIAL       PRIMARY KEY,
    department      VARCHAR(20)  NOT NULL,
    external_id     INTEGER      NOT NULL,
    title           VARCHAR(300) NOT NULL,
    url             VARCHAR(500) NOT NULL,
    published_at    TIMESTAMPTZ  NOT NULL,
    fetched_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (department, external_id)
);

CREATE INDEX IF NOT EXISTS idx_department_notices_dept_published
    ON department_notices (department, published_at DESC);

CREATE TABLE IF NOT EXISTS academic_calendar (
    id              SERIAL       PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    start_date      DATE         NOT NULL,
    end_date        DATE,
    fetched_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (title, start_date, end_date)
);

CREATE INDEX IF NOT EXISTS idx_academic_calendar_start_date
    ON academic_calendar (start_date);

-- ------------------------------------------------------------
-- 배포 후 확인 (읽기 전용):
--   \d department_notices
--   \d academic_calendar
--   SELECT count(*) FROM department_notices;
--   SELECT count(*) FROM academic_calendar;
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 롤백 (필요 시 수동 실행 — 수집된 공지/학사일정 데이터가 모두 사라지므로 신중히):
--   DROP INDEX IF EXISTS idx_department_notices_dept_published;
--   DROP INDEX IF EXISTS idx_academic_calendar_start_date;
--   DROP TABLE IF EXISTS department_notices;
--   DROP TABLE IF EXISTS academic_calendar;
-- ------------------------------------------------------------
