-- 2026-07-18 F5 "노선 알림(막차/첫차 시각 푸시)" — push_subscriptions 테이블 신설
--
-- 배경: 이 앱은 로그인/사용자 계정이 없다. 즐겨찾기(favorites.routes)는 브라우저
-- zustand persist에만 있는 문자열 배열(favCode)이다. Web Push는 사용자 계정 없이도
-- 동작한다 — 브라우저 PushManager.subscribe()가 반환하는 endpoint URL 자체가
-- 기기+브라우저별 고유 식별자이므로 이를 기본 키로 쓴다(새 유저 테이블 없음).
--
-- favorite_codes: 프론트 favCode 문자열 배열 스냅샷(구독 시점/변경 시 갱신).
-- last_notified: 오늘 하루 중복 발송 방지. {"<favCode>:last": "YYYY-MM-DD",
--   "<favCode>:first": "YYYY-MM-DD"} 형태로 (favCode, edge)별 마지막 발송 날짜(KST) 기록.
--
-- 적용 순서(운영 DB, 수동 실행):
--   1. 아래 CREATE TABLE + TRIGGER 실행.
--   2. backend .env / Railway 환경변수에 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY /
--      VAPID_SUBJECT 를 설정 (키 생성 방법은 backend/app/core/config.py 주석 참고:
--      `pip install py-vapid && vapid --gen` 후 생성된 키를 base64url로 인코딩).
--   3. 백엔드 재배포(스케줄러가 5분 주기로 push_notification_cycle을 등록한다).
--
-- 트리거 함수 set_updated_at()은 scripts/schema.sql에 이미 정의되어 있다(notices
-- 테이블 도입 시 생성됨) — 운영 DB에도 이미 존재하므로 CREATE OR REPLACE로 재정의해
-- 순서 의존성 없이 이 마이그레이션을 단독 실행할 수 있게 한다.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id              SERIAL       PRIMARY KEY,
    endpoint        TEXT         UNIQUE NOT NULL,
    p256dh_key      TEXT         NOT NULL,
    auth_key        TEXT         NOT NULL,
    favorite_codes  JSONB        NOT NULL DEFAULT '[]',
    last_notified   JSONB        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 배포 후 확인 (읽기 전용):
--   \d push_subscriptions
--   SELECT count(*) FROM push_subscriptions;
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 롤백 (필요 시 수동 실행 — 모든 구독 데이터가 사라지므로 신중히):
--   DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON push_subscriptions;
--   DROP TABLE IF EXISTS push_subscriptions;
-- ------------------------------------------------------------
