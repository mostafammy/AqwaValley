import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required to configure TimescaleDB.");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

try {
  await sql`CREATE EXTENSION IF NOT EXISTS timescaledb`;
  await sql`
    SELECT create_hypertable(
      'sensor_data',
      by_range('timestamp'),
      if_not_exists => TRUE
    )
  `;

  console.log("TimescaleDB extension and hypertable setup completed.");
} catch (error) {
  console.error("TimescaleDB setup failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
