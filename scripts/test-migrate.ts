import { config } from "dotenv";
config();
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const run = async () => {
  console.log("Starting migration manually...");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(sql);
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Migration successful");
  } catch (err) {
    console.error("Migration failed with error:");
    console.error(err);
  } finally {
    await sql.end();
  }
};

run().catch(console.error);
