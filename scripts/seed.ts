#!/usr/bin/env tsx
/**
 * scripts/seed.ts
 *
 * Development seed: 2 districts × 10 wells × 3 sensors = 60 sensors.
 * Generates 48 hours of historical readings with random anomalies, alert
 * rules, role catalog, a seed admin user, and demo API keys.
 *
 * Run: pnpm db:seed
 */

import { existsSync, readFileSync } from "fs";
import { createHash, randomBytes, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema";

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

// ---------------------------------------------------------------------------
// Standalone DB connection (no Next.js env.js validation at script runtime)
// ---------------------------------------------------------------------------
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  process.exit(1);
}

const queryClient = postgres(connectionString, { max: 1 });
const db = drizzle(queryClient, { schema });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function gaussianRandom(mean: number, stddev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stddev;
}

function generateApiKeyRaw(): string {
  return randomBytes(32).toString("hex");
}

function hashApiKeySync(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
let SEED_ADMIN_ID: string = randomUUID();
type DistrictSeed = {
  name: string;
  centerLat: number;
  centerLng: number;
  baselineDepthM: string;
  annualDepletionRateM: string;
  safeYieldM3Yr: string;
  warningThresholdPct: string;
  criticalThresholdPct: string;
};

const DISTRICTS: DistrictSeed[] = [
  {
    name: "El Kharga",
    centerLat: 25.4474,
    centerLng: 30.546,
    baselineDepthM: "92.00",
    annualDepletionRateM: "0.1200",
    safeYieldM3Yr: "38000000.00",
    warningThresholdPct: "75.00",
    criticalThresholdPct: "90.00",
  },
  {
    name: "El Dakhla",
    centerLat: 25.4951,
    centerLng: 28.9802,
    baselineDepthM: "86.00",
    annualDepletionRateM: "0.1000",
    safeYieldM3Yr: "34000000.00",
    warningThresholdPct: "75.00",
    criticalThresholdPct: "90.00",
  },
  {
    name: "El Farafra",
    centerLat: 27.0568,
    centerLng: 27.97,
    baselineDepthM: "98.00",
    annualDepletionRateM: "0.1400",
    safeYieldM3Yr: "26000000.00",
    warningThresholdPct: "75.00",
    criticalThresholdPct: "90.00",
  },
  {
    name: "Paris",
    centerLat: 24.7,
    centerLng: 30.6,
    baselineDepthM: "95.00",
    annualDepletionRateM: "0.1300",
    safeYieldM3Yr: "22000000.00",
    warningThresholdPct: "75.00",
    criticalThresholdPct: "90.00",
  },
  {
    name: "Balat",
    centerLat: 25.56,
    centerLng: 29.29,
    baselineDepthM: "88.00",
    annualDepletionRateM: "0.1100",
    safeYieldM3Yr: "24000000.00",
    warningThresholdPct: "75.00",
    criticalThresholdPct: "90.00",
  },
];
const WELLS_PER_DISTRICT = 10;
const READING_INTERVAL_MINUTES = 10; // one reading every 10 min
const HISTORY_HOURS = 48;

const SENSOR_SPECS = [
  {
    type: "water_level" as const,
    unit: "meters" as const,
    name: "Water Level Sensor",
    mean: 12.5,
    stddev: 0.8,
  },
  {
    type: "flow_rate" as const,
    unit: "m3_per_hour" as const,
    name: "Flow Rate Sensor",
    mean: 4.2,
    stddev: 0.5,
  },
  {
    type: "pressure" as const,
    unit: "bar" as const,
    name: "Pressure Sensor",
    mean: 2.1,
    stddev: 0.15,
  },
];

type RoleType =
  | "admin"
  | "district_manager"
  | "farm_owner"
  | "farmer"
  | "auditor";
const ROLE_CATALOG: {
  type: RoleType;
  displayName: string;
  description: string;
}[] = [
  {
    type: "admin",
    displayName: "System Administrator",
    description: "Full system access and user management",
  },
  {
    type: "district_manager",
    displayName: "District Manager",
    description: "Manage wells and farms within assigned district",
  },
  {
    type: "farm_owner",
    displayName: "Farm Owner",
    description: "View and manage owned farms and wells",
  },
  {
    type: "farmer",
    displayName: "Farmer",
    description: "View farm data and usage reports",
  },
  {
    type: "auditor",
    displayName: "Auditor",
    description: "Read-only access across all districts",
  },
];

// ---------------------------------------------------------------------------
// Seed seed admin user
// ---------------------------------------------------------------------------
async function seedAdminUser() {
  console.log("  Creating seed admin user...");
  const now = new Date();

  await db
    .insert(schema.user)
    .values({
      id: SEED_ADMIN_ID,
      name: "Seed Administrator",
      email: "admin@seed.local",
      username: "admin_seed",
      displayUsername: "Admin_Seed",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const [adminUser] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, "admin@seed.local"))
    .limit(1);

  if (!adminUser) {
    throw new Error("Seed admin user was not found after insert.");
  }

  // Reuse existing ID when admin email already exists.
  SEED_ADMIN_ID = adminUser.id;

  // Resolve admin role id
  const [adminRoleRecord] = await db
    .select({ id: schema.role.id })
    .from(schema.role)
    .where(eq(schema.role.type, "admin"))
    .limit(1);

  if (adminRoleRecord) {
    await db
      .insert(schema.userRoleAssignment)
      .values({
        userId: SEED_ADMIN_ID,
        roleId: adminRoleRecord.id,
        assignedBy: SEED_ADMIN_ID,
      })
      .onConflictDoNothing();
  }

  console.log(`  Admin user: admin@seed.local (id: ${SEED_ADMIN_ID})`);
  console.log("  Note: Create credentials via Better Auth sign-up flow.");
}

// ---------------------------------------------------------------------------
// Seed roles
// ---------------------------------------------------------------------------
async function seedRoles() {
  console.log("  Seeding role catalog...");
  for (const r of ROLE_CATALOG) {
    await db.insert(schema.role).values(r).onConflictDoNothing();
  }
  console.log(`  Inserted ${ROLE_CATALOG.length} roles.`);
}

// ---------------------------------------------------------------------------
// Seed districts
// ---------------------------------------------------------------------------
async function seedDistricts(): Promise<
  Array<{ id: string; seed: DistrictSeed }>
> {
  console.log("  Seeding districts...");
  const records: Array<{ id: string; seed: DistrictSeed }> = [];

  for (const d of DISTRICTS) {
    const [record] = await db
      .insert(schema.district)
      .values({
        name: d.name,
        baselineDepthM: d.baselineDepthM,
        annualDepletionRateM: d.annualDepletionRateM,
        safeYieldM3Yr: d.safeYieldM3Yr,
        warningThresholdPct: d.warningThresholdPct,
        criticalThresholdPct: d.criticalThresholdPct,
      })
      .onConflictDoNothing()
      .returning({ id: schema.district.id });

    if (record) {
      records.push({ id: record.id, seed: d });
      console.log(`    District: "${d.name}" → ${record.id}`);
    } else {
      // Already exists — fetch id
      const [existing] = await db
        .select({ id: schema.district.id })
        .from(schema.district)
        .where(eq(schema.district.name, d.name))
        .limit(1);
      if (existing) records.push({ id: existing.id, seed: d });
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// Seed wells + sensors + readings + alert rules
// ---------------------------------------------------------------------------
async function seedWells(
  districtRecords: Array<{ id: string; seed: DistrictSeed }>,
): Promise<{ wellId: string; sensorIds: string[]; districtId: string }[]> {
  console.log("  Seeding wells, sensors, and sensor data...");
  const allWells: {
    wellId: string;
    sensorIds: string[];
    districtId: string;
  }[] = [];

  for (const districtRecord of districtRecords) {
    const districtId = districtRecord.id;
    for (let w = 1; w <= WELLS_PER_DISTRICT; w++) {
      // Coordinates around each real New Valley district center (~8-10km spread)
      const lat = districtRecord.seed.centerLat + (Math.random() - 0.5) * 0.18;
      const lng = districtRecord.seed.centerLng + (Math.random() - 0.5) * 0.18;
      const baselineDepth = Number(districtRecord.seed.baselineDepthM);

      const [wellRecord] = await db
        .insert(schema.well)
        .values({
          districtId,
          name: `${districtRecord.seed.name} Well ${w.toString().padStart(2, "0")}`,
          depthM: (baselineDepth + (Math.random() * 28 - 8)).toFixed(2),
          status: "active",
          hasSensor: false,
          latitude: lat.toFixed(8),
          longitude: lng.toFixed(8),
          baselineFlowRateM3Hr: (3 + Math.random() * 3).toFixed(2),
          maxFlowRateM3Hr: (8 + Math.random() * 4).toFixed(2),
          currentLevelPct: (50 + Math.random() * 40).toFixed(2),
          valveState: "closed",
        })
        .returning({ id: schema.well.id });

      if (!wellRecord) continue;
      const wellId = wellRecord.id;

      // Status history entry
      await db.insert(schema.wellStatusHistory).values({
        wellId,
        changedBy: SEED_ADMIN_ID,
        fromStatus: null,
        toStatus: "active",
        reason: "Initial seeding",
      });

      // Attach sensors
      const sensorIds: string[] = [];
      for (const spec of SENSOR_SPECS) {
        const [sensorRecord] = await db
          .insert(schema.sensors)
          .values({
            wellId,
            type: spec.type,
            unit: spec.unit,
            name: spec.name,
            isActive: true,
          })
          .returning({ id: schema.sensors.id });

        if (!sensorRecord) continue;
        sensorIds.push(sensorRecord.id);
      }

      // Mark well as having sensors
      await db
        .update(schema.well)
        .set({ hasSensor: true })
        .where(eq(schema.well.id, wellId));

      // Seed 48h of historical readings (batch per sensor)
      const now = new Date();
      const readings: { sensorId: string; value: number; timestamp: Date }[] =
        [];

      for (let s = 0; s < sensorIds.length; s++) {
        const spec = SENSOR_SPECS[s]!;
        const sensorId = sensorIds[s]!;
        const totalReadings = (HISTORY_HOURS * 60) / READING_INTERVAL_MINUTES;

        for (let i = totalReadings; i >= 0; i--) {
          const timestamp = new Date(
            now.getTime() - i * READING_INTERVAL_MINUTES * 60_000,
          );

          // 5% anomaly injection
          const isAnomaly = Math.random() < 0.05;
          const value = isAnomaly
            ? spec.mean + (Math.random() > 0.5 ? 1 : -1) * spec.stddev * 4
            : gaussianRandom(spec.mean, spec.stddev);

          readings.push({ sensorId, value: Math.max(0, value), timestamp });
        }
      }

      // Bulk insert in chunks of 1000
      const chunkSize = 1000;
      for (let c = 0; c < readings.length; c += chunkSize) {
        await db
          .insert(schema.sensorData)
          .values(readings.slice(c, c + chunkSize));
      }

      // Seed latest_sensor_state (most recent reading per sensor)
      for (let s = 0; s < sensorIds.length; s++) {
        const spec = SENSOR_SPECS[s]!;
        const sensorId = sensorIds[s]!;
        await db
          .insert(schema.latestSensorState)
          .values({
            sensorId,
            wellId,
            value: gaussianRandom(spec.mean, spec.stddev),
            unit: spec.unit,
            type: spec.type,
            lastUpdatedAt: now,
          })
          .onConflictDoNothing();
      }

      // Alert rules (one per sensor spec)
      await db.insert(schema.alertRule).values([
        {
          wellId,
          sensorType: "water_level",
          operator: "lt",
          threshold: 5.0,
          severity: "critical",
          suppressionWindowMinutes: 30,
          isActive: true,
          createdByUserId: SEED_ADMIN_ID,
        },
        {
          wellId,
          sensorType: "flow_rate",
          operator: "gt",
          threshold: 8.0,
          severity: "warning",
          suppressionWindowMinutes: 15,
          isActive: true,
          createdByUserId: SEED_ADMIN_ID,
        },
        {
          wellId,
          sensorType: "pressure",
          operator: "gt",
          threshold: 3.5,
          severity: "warning",
          suppressionWindowMinutes: 15,
          isActive: true,
          createdByUserId: SEED_ADMIN_ID,
        },
      ]);

      allWells.push({ wellId, sensorIds, districtId });
    }
  }

  console.log(
    `  Created ${allWells.length} wells with sensors and historical data.`,
  );
  return allWells;
}

// ---------------------------------------------------------------------------
// Seed demo API keys (one per district, scoped to first well in district)
// ---------------------------------------------------------------------------
async function seedApiKeys(
  wells: { wellId: string; sensorIds: string[]; districtId: string }[],
  districtCount: number,
) {
  console.log("  Generating demo API keys...");

  const keys: { name: string; rawKey: string }[] = [];

  for (let i = 0; i < Math.min(districtCount, wells.length); i++) {
    const well = wells[i * WELLS_PER_DISTRICT]!;
    const rawKey = generateApiKeyRaw();
    const hashed = hashApiKeySync(rawKey);

    await db
      .insert(schema.apiKey)
      .values({
        hashedKey: hashed,
        name: `Demo IoT Key — District ${i + 1}`,
        wellId: well.wellId,
        createdByUserId: SEED_ADMIN_ID,
        isActive: true,
      })
      .onConflictDoNothing();

    keys.push({ name: `Demo IoT Key — District ${i + 1}`, rawKey });
  }

  console.log("\n  ┌─────────────────────────────────────────────────────┐");
  console.log("  │  DEMO API KEYS (save these — shown only once)       │");
  console.log("  └─────────────────────────────────────────────────────┘");
  for (const k of keys) {
    console.log(`  ${k.name}:`);
    console.log(`    ${k.rawKey}\n`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("🌱 AqwaValley seed starting...\n");

  await seedRoles();
  await seedAdminUser();
  const districtRecords = await seedDistricts();

  if (districtRecords.length !== DISTRICTS.length) {
    console.error(
      "Expected districts:",
      DISTRICTS.length,
      "got:",
      districtRecords.length,
    );
    process.exit(1);
  }

  const wells = await seedWells(districtRecords);
  await seedApiKeys(wells, districtRecords.length);

  console.log("\n✅ Seed complete.");
  console.log(`   Districts: ${districtRecords.length}`);
  console.log(`   Wells: ${wells.length}`);
  console.log(`   Sensors: ${wells.length * SENSOR_SPECS.length}`);
  console.log(
    `   Readings: ~${wells.length * SENSOR_SPECS.length * ((HISTORY_HOURS * 60) / READING_INTERVAL_MINUTES)}`,
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => queryClient.end());
