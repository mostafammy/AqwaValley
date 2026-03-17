CREATE EXTENSION IF NOT EXISTS timescaledb;

SELECT create_hypertable(
  'sensor_data',
  by_range('timestamp'),
  if_not_exists => TRUE
);
