-- ============================================================
-- WARNING — 수동 검토 후 유지보수 윈도우(트래픽 낮은 새벽 02:00~03:59 KST,
-- GBIS 폴링 휴식 구간)에 단계별로 적용할 것. 절대 자동 실행/CI에 포함하지 말 것.
--
-- 이 스크립트는 문서화 목적으로만 작성되었으며, 이 작업(DB 엔지니어) 세션에서는
-- 실행하지 않는다. 적용 전 반드시:
--   1. prod DB 풀 백업(pg_dump 또는 스냅샷) 확보
--   2. 기존 223MB 테이블 전체를 재작성하므로 다운타임/락 발생을 감안한 공지
--   3. 아래 각 PHASE를 개별적으로 psql에서 실행하며 결과를 확인 후 다음 단계로 진행
--      (한 번에 전체를 실행하지 말 것 — 특히 PHASE 3 데이터 복사는 테이블 크기에
--      비례해 시간이 걸리고, PHASE 6 스왑 구간에서 짧은 EXCLUSIVE LOCK이 걸린다)
--   4. 이 테이블은 나이틀리 보존 job(app/services/retention.py, 03:45 KST)이
--      이미 90일 초과 행을 DELETE로 정리하고 있다. 파티셔닝의 목적은 그 DELETE를
--      "오래된 파티션 DROP"으로 대체해 WAL/vacuum 부담을 없애는 것.
--   5. ORM 모델(app/models/bus.py::BusCrowdingLog)은 변경하지 않는다 — 파티셔닝은
--      쿼리하는 쪽에서 투명하며, SQLAlchemy는 부모 테이블명(bus_crowding_logs)만
--      알면 된다.
--
-- 목표: recorded_at 기준 월별 RANGE 파티션으로 전환.
-- 방법: 새 파티션 부모 테이블 생성 → 월별 파티션 생성 → 기존 데이터 복사
--       → 부모 테이블 rename swap → 검증 → (별도 세션에서) 구 테이블 DROP.
-- ============================================================


-- ------------------------------------------------------------
-- PHASE 0. 사전 확인 (읽기 전용, 트랜잭션 불필요)
-- ------------------------------------------------------------
-- 데이터 범위 확인 → 몇 개월치 파티션이 필요한지 산정
-- SELECT min(recorded_at), max(recorded_at), count(*) FROM bus_crowding_logs;

-- 현재 인덱스/제약 확인 (재현 대상)
-- \d bus_crowding_logs


-- ------------------------------------------------------------
-- PHASE 1. 새 파티션 부모 테이블 생성
-- ------------------------------------------------------------
-- 기존 컬럼/기본값을 그대로 재현하되, PARTITION BY RANGE (recorded_at) 추가.
-- 파티션 테이블은 PRIMARY KEY에 파티션 키(recorded_at)를 포함해야 하므로
-- id 단독 PK 대신 (id, recorded_at) 복합 PK로 변경한다 — 애플리케이션은
-- id로 단건 조회하지 않으므로(항상 route_id/stop_id/recorded_at 범위 조회)
-- 영향 없음.
BEGIN;

CREATE TABLE bus_crowding_logs_new (
    id                BIGINT       NOT NULL,
    route_id          INTEGER      NOT NULL,
    stop_id           INTEGER      NOT NULL,
    plate_no          VARCHAR(20)  NOT NULL,
    crowded           INTEGER      NOT NULL,
    arrive_in_seconds INTEGER      NOT NULL,
    recorded_at       TIMESTAMPTZ  NOT NULL,
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- 기존 시퀀스를 재사용해 id 채번이 끊기지 않게 한다.
ALTER TABLE bus_crowding_logs_new
    ALTER COLUMN id SET DEFAULT nextval('bus_crowding_logs_id_seq');

COMMIT;


-- ------------------------------------------------------------
-- PHASE 2. 월별 파티션 생성
-- ------------------------------------------------------------
-- PHASE 0에서 확인한 min(recorded_at) ~ 다음 3개월 정도까지 커버하도록
-- start_month/end_month를 조정할 것. 아래는 예시(2025-10 ~ 2026-10 커버,
-- 실제 데이터 최소월/최대월에 맞춰 범위를 넓히거나 좁힐 것).
DO $$
DECLARE
    start_month DATE := '2025-10-01';  -- TODO: 실제 min(recorded_at)의 월초로 교체
    end_month   DATE := '2026-10-01';  -- TODO: 실제 max(recorded_at) + 1개월로 교체
    cur_month   DATE := start_month;
    part_name   TEXT;
BEGIN
    WHILE cur_month < end_month LOOP
        part_name := 'bus_crowding_logs_' || to_char(cur_month, 'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF bus_crowding_logs_new
               FOR VALUES FROM (%L) TO (%L)',
            part_name, cur_month, (cur_month + interval '1 month')
        );
        cur_month := cur_month + interval '1 month';
    END LOOP;

    -- 미래 안전망: 다음 달 이후 데이터가 들어올 경우를 대비한 기본 파티션
    -- (매달 나이틀리로 다음 달 파티션을 미리 만들지 못했을 때의 폴백).
    EXECUTE 'CREATE TABLE IF NOT EXISTS bus_crowding_logs_default
               PARTITION OF bus_crowding_logs_new DEFAULT';
END $$;


-- ------------------------------------------------------------
-- PHASE 3. 기존 데이터 복사
-- ------------------------------------------------------------
-- 223MB 규모라 단일 INSERT SELECT로 충분하지만, 운영 트래픽과 겹치면
-- 잠금 경합이 생길 수 있으니 유지보수 윈도우(02:00~03:59 KST) 안에서 실행.
-- 대용량이라 오래 걸리면 batch INSERT(예: recorded_at 월 단위 반복)로 나눌 것.
BEGIN;

INSERT INTO bus_crowding_logs_new (id, route_id, stop_id, plate_no, crowded, arrive_in_seconds, recorded_at)
SELECT id, route_id, stop_id, plate_no, crowded, arrive_in_seconds, recorded_at
FROM bus_crowding_logs;

COMMIT;

-- 검증: 행 수/합계가 동일한지 확인 후에만 다음 단계로 진행
-- SELECT count(*) FROM bus_crowding_logs;
-- SELECT count(*) FROM bus_crowding_logs_new;


-- ------------------------------------------------------------
-- PHASE 4. 인덱스/제약 재생성 (파티션 부모에 생성하면 각 파티션에 자동 전파됨)
-- ------------------------------------------------------------
BEGIN;

CREATE INDEX idx_crowding_route_stop_at_new
    ON bus_crowding_logs_new (route_id, stop_id, recorded_at);

ALTER TABLE bus_crowding_logs_new
    ADD CONSTRAINT bus_crowding_logs_new_route_id_fkey
        FOREIGN KEY (route_id) REFERENCES bus_routes(id) ON DELETE CASCADE,
    ADD CONSTRAINT bus_crowding_logs_new_stop_id_fkey
        FOREIGN KEY (stop_id) REFERENCES bus_stops(id);

COMMIT;


-- ------------------------------------------------------------
-- PHASE 5. 시퀀스 소유권 이전 (id 컬럼이 시퀀스를 소유하도록)
-- ------------------------------------------------------------
BEGIN;

ALTER SEQUENCE bus_crowding_logs_id_seq OWNED BY bus_crowding_logs_new.id;

COMMIT;


-- ------------------------------------------------------------
-- PHASE 6. 스왑 (짧은 EXCLUSIVE LOCK 구간 — 여기서만 다운타임 발생)
-- ------------------------------------------------------------
-- 이 트랜잭션 안에서만 실제 애플리케이션이 참조하는 이름이 바뀐다.
-- PHASE 3 이후 스왑 전까지 들어온 신규 로그(폴링 job이 계속 INSERT)를
-- 놓치지 않으려면, 가능하면 PHASE 3~6을 최대한 짧은 간격으로 연속 실행하거나,
-- 스왑 직전에 짧게 폴링 job을 일시 중지(scheduler.pause_job("bus_arrival_poll")
-- 은 crowding insert와 무관하므로 실제로는 GBIS 크롤러 프로세스 자체를 잠시
-- 멈추는 것을 고려할 것 — 별도 운영 절차 필요, 이 스크립트 범위 밖).
BEGIN;

ALTER TABLE bus_crowding_logs RENAME TO bus_crowding_logs_old;
ALTER TABLE bus_crowding_logs_new RENAME TO bus_crowding_logs;

-- 인덱스/제약 이름도 기존 컨벤션에 맞춰 정리 (선택 사항, 필수는 아님)
ALTER INDEX idx_crowding_route_stop_at_new RENAME TO idx_crowding_route_stop_at;
ALTER TABLE bus_crowding_logs
    RENAME CONSTRAINT bus_crowding_logs_new_route_id_fkey TO bus_crowding_logs_route_id_fkey;
ALTER TABLE bus_crowding_logs
    RENAME CONSTRAINT bus_crowding_logs_new_stop_id_fkey TO bus_crowding_logs_stop_id_fkey;

COMMIT;


-- ------------------------------------------------------------
-- PHASE 7. 스왑 후 검증 (읽기 전용)
-- ------------------------------------------------------------
-- SELECT count(*) FROM bus_crowding_logs;                 -- PHASE 3 검증치와 동일해야 함
-- SELECT count(*) FROM bus_crowding_logs_old;              -- 스왑 시점 이후 신규 insert가 없다면 동일
-- INSERT/SELECT가 정상 동작하는지 애플리케이션 스모크 테스트 (혼잡도 API 등)


-- ------------------------------------------------------------
-- PHASE 8. 구 테이블 정리 (검증 안정화 후, 별도 날짜에 별도로 실행 — 자동 실행 금지)
-- ------------------------------------------------------------
-- 최소 며칠간 신규 파티션 테이블이 문제 없이 동작함을 확인한 뒤에만 실행.
-- DROP TABLE bus_crowding_logs_old;


-- ============================================================
-- 롤백 (PHASE 6 스왑 이후 문제 발견 시, 즉시 실행)
-- ============================================================
-- BEGIN;
-- ALTER TABLE bus_crowding_logs RENAME TO bus_crowding_logs_new;
-- ALTER TABLE bus_crowding_logs_old RENAME TO bus_crowding_logs;
-- ALTER INDEX idx_crowding_route_stop_at RENAME TO idx_crowding_route_stop_at_new;
-- ALTER TABLE bus_crowding_logs
--     RENAME CONSTRAINT bus_crowding_logs_route_id_fkey TO bus_crowding_logs_new_route_id_fkey;
-- ALTER TABLE bus_crowding_logs
--     RENAME CONSTRAINT bus_crowding_logs_stop_id_fkey TO bus_crowding_logs_new_stop_id_fkey;
-- COMMIT;
-- -- 이후 bus_crowding_logs_new(구 파티션 구조)를 다시 조사하거나 DROP CASCADE로 폐기하고
-- -- 원래 bus_crowding_logs(비파티션)로 완전히 되돌아간 상태로 운영을 재개한다.
--
-- 롤백(PHASE 1 이후, 스왑 전 단계에서 중단하는 경우):
-- DROP TABLE IF EXISTS bus_crowding_logs_new CASCADE;
-- (원본 bus_crowding_logs는 전혀 건드리지 않았으므로 그대로 운영 계속 가능)
-- ============================================================
