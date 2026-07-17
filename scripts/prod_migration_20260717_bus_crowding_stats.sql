-- ============================================================
-- bus_crowding_stats: 혼잡도 곡선 사전 집계 테이블 신설
-- 목적: compute_crowding_flow()가 캐시미스마다 bus_crowding_logs
--       60일치를 직접 스캔(약 1.24s/호출, 테이블 커질수록 선형 악화)하던 것을
--       나이틀리 사전집계 테이블 조회(O(48 rows))로 대체.
-- 적용: 수동. Railway prod psql/console에서 아래 전체를 실행.
-- 멱등: CREATE TABLE IF NOT EXISTS + 인덱스는 IF NOT EXISTS 없는 버전이 없어
--       존재 시 에러가 나므로 CREATE INDEX 앞에도 IF NOT EXISTS 사용.
--       재실행해도 안전(이미 있으면 스킵).
-- ============================================================
BEGIN;

-- day_type: 다른 사전집계 테이블(bus_arrival_stats 등)의 weekday/saturday/sunday
-- 3분류와 달리, crowding_flow.py 도메인(isodow<=5 기준)을 그대로 따라
-- weekday/weekend 2분류다. API 쿼리 파라미터도 이미 이 2분류로 제한되어 있다
-- (backend/app/api/bus.py: day_type pattern="^(weekday|weekend)$").
--
-- bucket = hour*2 + half(0|1), 0~47 범위 (30분 단위 버킷 인덱스).
--
-- ON DELETE CASCADE on both FKs intentional: bus_arrival_stats와 동일하게,
-- route/stop이 삭제되면 파생 통계도 함께 제거되고 다음 나이틀리 refresh에서
-- 재생성된다.
CREATE TABLE IF NOT EXISTS bus_crowding_stats (
  route_id     INTEGER      NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
  stop_id      INTEGER      NOT NULL REFERENCES bus_stops(id) ON DELETE CASCADE,
  day_type     VARCHAR(10)  NOT NULL CHECK (day_type IN ('weekday','weekend')),
  bucket       SMALLINT     NOT NULL CHECK (bucket BETWEEN 0 AND 47),
  avg_crowded  NUMERIC(4,2) NOT NULL CHECK (avg_crowded BETWEEN 1 AND 4),
  sample_size  INTEGER      NOT NULL CHECK (sample_size > 0),
  sample_days  INTEGER      NOT NULL CHECK (sample_days > 0),
  computed_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, stop_id, day_type, bucket)
);

COMMIT;

-- ------------------------------------------------------------
-- 배포 후 확인 (읽기 전용, 트랜잭션 밖):
--   -- 테이블 생성 확인
--   \d bus_crowding_stats
--
--   -- 첫 나이틀리(03:35 KST) 실행 후 채워졌는지 확인 (0건이면 아직 미실행이거나
--   -- bus_crowding_logs 자체가 비어있는 것 — compute_crowding_flow는 이 경우
--   -- 원본 로그 집계로 자동 폴백하므로 엔드포인트는 정상 동작한다)
--   SELECT day_type, count(*) FROM bus_crowding_stats GROUP BY day_type;
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 롤백 (필요 시 수동 실행):
--   BEGIN;
--   DROP TABLE IF EXISTS bus_crowding_stats;
--   COMMIT;
--   -- crowding_flow.py는 사전집계 조회 실패(ProgrammingError) 시 자동으로
--   -- 원본-로그 집계 폴백 경로를 타므로, 테이블을 롤백해도 API는 계속 동작한다.
--   -- 단, scheduler.py의 bus_crowding_stats_refresh(03:35) job은 매일 예외를
--   -- 로그로 남기며 실패하므로(catch-and-log, 스케줄러 자체는 안 죽음),
--   -- 롤백 시 해당 job 등록도 코드에서 제거하는 배포를 병행할 것.
-- ------------------------------------------------------------
