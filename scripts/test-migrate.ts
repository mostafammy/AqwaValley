import { existsSync, readFileSync } from "fs";

/**
 * Basic environment loader to avoid 'dotenv' dependency
 */
function loadLocalEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const rawValue = trimmed.slice(idx + 1).trim();
      const value = rawValue.replace(/^['\"]|['\"]$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadLocalEnv();
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
