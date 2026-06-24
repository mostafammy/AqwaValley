import { db } from "../src/server/db/index";
import { sql } from "drizzle-orm";

async function checkFarmWells() {
  const result = await db.execute(sql`SELECT farm_id, COUNT(*) as well_count FROM farm_well GROUP BY farm_id`);
  console.log("Farms and well counts:");
  console.table(result);

  const sensors = await db.execute(sql`SELECT well_id, type, COUNT(*) FROM sensors GROUP BY well_id, type`);
  console.log("Sensors per well:");
  console.table(sensors);
  process.exit(0);
}

checkFarmWells().catch(e => {
  console.error(e);
  process.exit(1);
});
