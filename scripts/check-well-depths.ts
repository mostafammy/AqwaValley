import { db } from "../src/server/db/index";
import { well } from "../src/server/db/schema";
import { isNull } from "drizzle-orm";

async function checkDepths() {
  const allWells = await db.select({ id: well.id, name: well.name, depthM: well.depthM }).from(well);
  const nullDepths = await db.select({ id: well.id, name: well.name }).from(well).where(isNull(well.depthM));
  
  console.log(`Total Wells: ${allWells.length}`);
  console.log(`Wells with missing depthM: ${nullDepths.length}`);
  
  if (nullDepths.length > 0) {
    console.log("Wells missing depth:");
    nullDepths.forEach(w => console.log(`- ${w.name} (${w.id})`));
  }
  process.exit(0);
}

checkDepths().catch(e => {
  console.error(e);
  process.exit(1);
});
