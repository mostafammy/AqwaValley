import { db } from "../src/server/db/index";
import { sensorData, latestSensorState } from "../src/server/db/schema";
import { sql } from "drizzle-orm";

async function checkLatest() {
  const result = await db.execute(sql`
    SELECT MAX(timestamp) as latest_ts FROM sensor_data;
  `);
  console.log("Max timestamp in sensor_data:", result[0]?.latest_ts);
  
  const result2 = await db.execute(sql`
    SELECT MAX(last_updated_at) as latest_ts FROM latest_sensor_state;
  `);
  console.log("Max timestamp in latest_sensor_state:", result2[0]?.latest_ts);
  
  process.exit(0);
}

checkLatest().catch(e => {
  console.error(e);
  process.exit(1);
});
