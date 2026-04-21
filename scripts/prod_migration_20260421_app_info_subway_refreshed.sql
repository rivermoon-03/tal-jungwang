BEGIN;

ALTER TABLE app_info
    ADD COLUMN IF NOT EXISTS subway_last_refreshed_at TIMESTAMPTZ;

COMMIT;
