import { db } from "./src/server/db";
import { apiKey } from "./src/server/db/schema";

async function main() {
  const keys = await db.select().from(apiKey);
  console.log(JSON.stringify(keys, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
