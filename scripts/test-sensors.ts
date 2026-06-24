import { db } from "../src/server/db/index";
import { sql } from "drizzle-orm";

async function check() {
  const sensors = await db.execute(sql`SELECT type, COUNT(*) FROM sensors GROUP BY type`);
  console.log("Sensors by type:");
  console.table(sensors);
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
