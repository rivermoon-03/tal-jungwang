BEGIN;

-- bus_arrival_stats is derivative (recomputed nightly from bus_arrival_history).
-- ON DELETE CASCADE on both FKs intentional: if a route/stop is removed,
-- precomputed stats should be removed too — they'll be recreated on next refresh.
CREATE TABLE IF NOT EXISTS bus_arrival_stats (
  route_id          INTEGER      NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
  stop_id           INTEGER      NOT NULL REFERENCES bus_stops(id) ON DELETE CASCADE,
  day_type          VARCHAR(10)  NOT NULL CHECK (day_type IN ('weekday','saturday','sunday')),
  hour_of_day       SMALLINT     NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  p10_interval_sec  INTEGER      NOT NULL CHECK (p10_interval_sec >= 0),
  p50_interval_sec  INTEGER      NOT NULL CHECK (p50_interval_sec >= 0),
  p90_interval_sec  INTEGER      NOT NULL CHECK (p90_interval_sec >= 0),
  mean_interval_sec INTEGER      NOT NULL CHECK (mean_interval_sec >= 0),
  sample_size       INTEGER      NOT NULL CHECK (sample_size > 0),
  computed_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, stop_id, day_type, hour_of_day)
);

COMMIT;
