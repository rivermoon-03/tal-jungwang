-- ============================================================
-- prod 직접 적용 마이그레이션 — 2026-08-02 (2차)
-- 전교 게시판 공지 테이블(DS1: 학사/장학/취업/비교과/생활관)
--
-- 학과 공지(RSS, department_notices)는 이번 개편에서 UI·수집이 제거된다.
-- 테이블 자체는 보존한다(데이터 이력 — 삭제할 이유 없음).
-- 수집 경로는 robots.txt 허용 목록 페이지만 사용(/bbs/ 본문 크롤 금지) —
-- app/services/external/tukorea_boards.py 머리말 참고.
--
-- 적용: psql "$DATABASE_URL" -f scripts/prod_migration_20260802_school_board_notices.sql
-- 적용 후: 별도 캐시 정리 불필요(신규 키). 다음 크론(60분) 또는 배포 직후
--          첫 잡 실행에서 데이터가 채워진다.
-- 재실행 안전: IF NOT EXISTS.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS school_board_notices (
    id              SERIAL       PRIMARY KEY,
    category        VARCHAR(20)  NOT NULL,
    external_id     INTEGER      NOT NULL,
    title           VARCHAR(300) NOT NULL,
    url             VARCHAR(500) NOT NULL,
    published_at    TIMESTAMPTZ  NOT NULL,
    fetched_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (category, external_id)
);

CREATE INDEX IF NOT EXISTS idx_school_board_notices_cat_published
    ON school_board_notices (category, published_at DESC);

COMMIT;
