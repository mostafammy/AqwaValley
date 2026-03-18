CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert sensor_data to a time-series hypertable partitioned daily
SELECT create_hypertable(
  'sensor_data',
  by_range('timestamp'),
  chunk_time_interval => INTERVAL '1 day',
  migrate_data => TRUE,
  if_not_exists => TRUE
);

-- Compress chunks older than 7 days to reduce storage
ALTER TABLE sensor_data SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'sensor_id'
);

SELECT add_compression_policy('sensor_data', INTERVAL '7 days', if_not_exists => TRUE);

-- Retention: drop chunks older than the configured threshold (default 90 days)
-- Adjust the interval to match TIMESCALE_RETENTION_DAYS from env
SELECT add_retention_policy('sensor_data', INTERVAL '90 days', if_not_exists => TRUE);

-- Continuous aggregate: 1-hour bucket summaries per sensor
CREATE MATERIALIZED VIEW sensor_data_1h
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', timestamp) AS bucket,
  sensor_id,
  AVG(value)   AS avg_value,
  MIN(value)   AS min_value,
  MAX(value)   AS max_value,
  COUNT(*)     AS reading_count
FROM sensor_data
GROUP BY bucket, sensor_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('sensor_data_1h',
  start_offset => INTERVAL '2 hours',
  end_offset   => INTERVAL '1 hour',
  schedule_interval => INTERVAL '30 minutes',
  if_not_exists => TRUE
);

-- Continuous aggregate: 1-day bucket summaries per sensor
CREATE MATERIALIZED VIEW sensor_data_1d
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', timestamp) AS bucket,
  sensor_id,
  AVG(value)   AS avg_value,
  MIN(value)   AS min_value,
  MAX(value)   AS max_value,
  COUNT(*)     AS reading_count
FROM sensor_data
GROUP BY bucket, sensor_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('sensor_data_1d',
  start_offset => INTERVAL '2 days',
  end_offset   => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);
