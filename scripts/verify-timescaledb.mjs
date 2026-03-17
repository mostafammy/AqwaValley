import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

try {
  const ext = await sql.unsafe(
    "select extname, extversion from pg_extension where extname = 'timescaledb'",
  );

  const hypertables = await sql.unsafe(
    "select hypertable_schema, hypertable_name from timescaledb_information.hypertables where hypertable_name = 'sensor_data'",
  );

  const relation = await sql.unsafe(
    "select relname, relkind from pg_class where relname = 'sensor_data'",
  );

  console.log("timescaledb_extension:", JSON.stringify(ext));
  console.log("hypertables:", JSON.stringify(hypertables));
  console.log("relation:", JSON.stringify(relation));
} catch (error) {
  console.error("Verification failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
