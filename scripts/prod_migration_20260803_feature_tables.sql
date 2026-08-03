-- 2026-08-03 신규 기능 배치 마이그레이션
-- B1 막차 푸시(push_subscriptions.preferences) + B4 혼잡 프로파일(subway_crowding_profile)
-- 근거: docs/2026-08-03-research-batch-implementation.md
--
-- ⚠ 적용 순서 주의: preferences 컬럼은 모델이 SELECT 하므로
--   이 마이그레이션을 **백엔드 배포 전에** 프로덕션 DB에 먼저 적용해야 한다.
--   (미적용 상태로 배포하면 push 경로 전체가 깨진다. 로컬 docker 볼륨도 동일.)
-- 롤백: ALTER TABLE push_subscriptions DROP COLUMN preferences; DROP TABLE subway_crowding_profile;

BEGIN;

-- B1: 구독별 알림 프리퍼런스 — {"last_train": {"enabled": bool, "lead_min": 15|30|60}}
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

-- B4: 지하철 시간대 혼잡 프로파일 (stcis 교통카드 통계, 수동 적재 전용 — cron 없음)
-- 적재 전에는 비어 있고, 비어 있는 동안 API는 빈 배열·프런트는 섹션 미렌더.
CREATE TABLE IF NOT EXISTS subway_crowding_profile (
    station_name varchar(20)  NOT NULL,  -- 정왕|시흥시청|초지
    line_id      varchar(10)  NOT NULL,  -- 1004(4호선)|1075(수인분당선)|1093(서해선)
    direction    varchar(10)  NOT NULL CHECK (direction IN ('up', 'down')),
    day_type     varchar(10)  NOT NULL CHECK (day_type IN ('weekday', 'saturday', 'sunday')),
    hour         smallint     NOT NULL CHECK (hour BETWEEN 0 AND 23),
    level        numeric(3,2) NOT NULL CHECK (level >= 0 AND level <= 1),  -- 그룹 내 0~1 정규화 혼잡도
    source       varchar(50)  NOT NULL,  -- 예: 'stcis-2026-06'
    updated_at   timestamptz  NOT NULL,
    PRIMARY KEY (station_name, line_id, direction, day_type, hour)
);

COMMIT;
