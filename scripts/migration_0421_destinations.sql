-- ============================================================
-- prod 직접 적용 마이그레이션 — 2026-04-21
-- destinations 테이블 신규 (하교 탭 목적지 picker용)
-- 적용: psql "$DATABASE_URL" -f scripts/migration_0421_destinations.sql
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS destinations (
    id           SERIAL PRIMARY KEY,
    code         VARCHAR(30) NOT NULL,
    name         VARCHAR(40) NOT NULL,
    kind         VARCHAR(20) NOT NULL,
    lat          NUMERIC(9, 6),
    lng          NUMERIC(9, 6),
    sort_order   SMALLINT NOT NULL DEFAULT 0,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_destinations_code UNIQUE (code)
);

INSERT INTO destinations (code, name, kind, lat, lng, sort_order) VALUES
    ('jeongwang', '정왕역',  'subway_station', 37.351618, 126.742747, 10),
    ('sadang',    '사당',    'area',            37.476595, 126.981633, 20),
    ('gangnam',   '강남',    'area',            37.497940, 127.027621, 30),
    ('seoksu',    '석수',    'area',            37.455837, 126.902128, 40),
    ('suwon',     '수원',    'area',            37.263573, 127.028601, 50)
ON CONFLICT (code) DO NOTHING;

COMMIT;

-- ============================================================
-- 적용 후 검증
-- ============================================================
-- SELECT code, name, kind, sort_order FROM destinations ORDER BY sort_order;
-- Expected 5 rows in the order above.
