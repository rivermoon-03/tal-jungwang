-- 2026-07-18 나이틀리 보존정책(retention.py) 삭제 쿼리용 단독 인덱스 추가
--
-- 배경: backend/app/services/retention.py::_purge_table_batched()의 삭제 쿼리는
--   DELETE FROM <table>
--   WHERE ctid IN (
--       SELECT ctid FROM <table>
--       WHERE <time_column> < now() - interval '<retention>'
--       LIMIT 5000
--   )
-- 즉 내부 서브쿼리의 WHERE 조건이 시각 컬럼 하나뿐이다(다른 컬럼과 AND로
-- 결합되지 않음). 따라서 쿼리 플랜상 필요한 건 시각 컬럼이 선두인 인덱스이며,
-- 다른 컬럼을 앞세운 복합 인덱스로는 이 조건을 인덱스 스캔으로 satisfy할 수 없다.
--
-- 대상 2테이블의 기존 인덱스는 모두 시각 컬럼이 선두가 아니어서 못 쓰인다:
--   idx_crowding_route_stop_at(route_id, stop_id, recorded_at)
--   idx_bus_arrival_route_stop_day(route_id, stop_id, day_type, arrived_at)
-- → 매 나이틀리(03:45 KST)마다 두 테이블 모두 seq scan이 반복되고, 테이블이
--   커질수록 정리 시간이 선형 이상으로 늘어난다.
-- traffic_history는 이미 idx_traffic_collected_at(collected_at) 단독 인덱스가
-- 있어 문제가 없다 — 이번 변경은 그 패턴을 나머지 2테이블에도 맞추는 것이다.
--
-- 왜 복합 인덱스가 아니라 단독 컬럼 인덱스인가:
--   삭제 서브쿼리에 route_id/stop_id/day_type 필터가 전혀 없으므로(전체 테이블
--   대상 시각 범위 스캔) 복합 인덱스의 선두 컬럼을 시각으로 바꾸는 것도 검토했으나,
--   그러면 기존 route_id/stop_id 조회 패턴(혼잡도 API, 도착 이력 조회)이 인덱스를
--   잃는다. 단독 컬럼 인덱스를 별도로 추가하는 편이 두 쿼리 패턴을 모두 커버한다.
--
-- CREATE INDEX CONCURRENTLY는 트랜잭션 블록 안에서 실행할 수 없다.
-- 아래 두 문장은 반드시 트랜잭션 블록(BEGIN/COMMIT) 밖에서, psql로 개별
-- 실행할 것(autocommit 모드). 운영 중 테이블 락 없이 적용 가능하다.
-- 유지보수 윈도우가 필수는 아니지만, 대상 테이블이 크면(수십만 행 이상)
-- 완료까지 다소 시간이 걸릴 수 있으니 트래픽이 낮은 새벽 시간대 권장.
--
-- 멱등: CONCURRENTLY는 IF NOT EXISTS와 함께 쓸 수 있어(PG 9.5+) 재실행 안전.
-- 단, 이전 실행이 실패해 INVALID 인덱스가 남아있다면 아래 확인 쿼리로 찾아
-- DROP INDEX CONCURRENTLY 후 재실행할 것.
--   SELECT indexrelid::regclass, indisvalid
--   FROM pg_index WHERE indisvalid = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_crowding_recorded_at
    ON bus_crowding_logs (recorded_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bus_arrival_arrived_at
    ON bus_arrival_history (arrived_at);

-- ------------------------------------------------------------
-- 배포 후 확인 (읽기 전용):
--   \d bus_crowding_logs
--   \d bus_arrival_history
--
--   -- retention.py의 삭제 서브쿼리가 인덱스를 타는지 확인
--   EXPLAIN SELECT ctid FROM bus_crowding_logs
--     WHERE recorded_at < now() - interval '90 days' LIMIT 5000;
--   EXPLAIN SELECT ctid FROM bus_arrival_history
--     WHERE arrived_at < now() - interval '90 days' LIMIT 5000;
--   -- 위 둘 다 "Index Scan using idx_..." 가 나와야 한다(Seq Scan이면 실패).
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 롤백 (필요 시 수동 실행, 이것도 CONCURRENTLY로 락 없이 제거 가능):
--   DROP INDEX CONCURRENTLY IF EXISTS idx_crowding_recorded_at;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_bus_arrival_arrived_at;
--   -- 롤백해도 retention.py는 계속 정상 동작한다(seq scan으로 되돌아갈 뿐,
--   -- 기능적으로는 영향 없음 — 순수 성능 인덱스이므로 안전).
-- ------------------------------------------------------------

-- 참고: scripts/prod_migration_20260717_bus_crowding_logs_partition.sql(문서화
-- 전용, 아직 미적용)이 향후 bus_crowding_logs를 파티션 테이블로 전환할 때는
-- PHASE 4에서 idx_crowding_recorded_at도 함께 재생성해야 한다(현재 그 스크립트의
-- PHASE 4는 idx_crowding_route_stop_at_new만 생성하므로 파티셔닝 적용 시 갱신 필요).
