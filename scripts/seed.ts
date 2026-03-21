#!/usr/bin/env tsx
/**
 * scripts/seed.ts
 *
 * Cleanup-first regional seed for Egypt's New Valley Governorate.
 * Creates real district names, region-specific farms and crop profiles,
 * IoT wells/sensors/readings, and matching user accounts for owners/farmers.
 *
 * Run: pnpm db:seed
 */

import { existsSync, readFileSync } from "fs";
import { createHash, randomBytes, randomUUID } from "crypto";
import { eq, inArray, sql } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "../src/server/db/schema";
// auth import moved to dynamic imports inside functions to avoid early env validation


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

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("ERROR: DATABASE_URL environment variable is required.");
  process.exit(1);
}

const queryClient = postgres(connectionString, { max: 1 });
const db = drizzle(queryClient, { schema });

type RoleType =
  | "admin"
  | "district_manager"
  | "farm_owner"
  | "farmer"
  | "auditor";
type CropType =
  | "wheat"
  | "rice"
  | "corn"
  | "cotton"
  | "sugarcane"
  | "vegetables"
  | "fruits"
  | "other";
type GrowthStage =
  | "germination"
  | "vegetative"
  | "flowering"
  | "fruiting"
  | "maturity"
  | "harvest";

type FarmSeed = {
  name: string;
  cropType: CropType;
  cropLabel: string;
  growthStage: GrowthStage;
  targetSoilMoisturePct: string;
  totalAreaAcres: string;
  monthlyQuotaM3: string;
  annualQuotaM3: string;
  plantedDaysAgo: number;
  expectedHarvestInDays: number;
  priorCropType: CropType;
  priorCropLabel: string;
  priorYieldKgPerAcre: string;
};

type DistrictSeed = {
  name: string;
  centerLat: number;
  centerLng: number;
  baselineDepthM: string;
  annualDepletionRateM: string;
  safeYieldM3Yr: string;
  warningThresholdPct: string;
  criticalThresholdPct: string;
  farms: FarmSeed[];
};

const SEED_EMAIL_DOMAIN = "seed.local";
const LEGACY_SEED_DISTRICT_NAMES = [
  "Northern Aquifer District",
  "Southern Aquifer District",
];

let SEED_ADMIN_ID: string = randomUUID();

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
    farms: [
      {
        name: "Kharga Date Palm Cooperative",
        cropType: "fruits",
        cropLabel: "Date palms",
        growthStage: "fruiting",
        targetSoilMoisturePct: "31.00",
        totalAreaAcres: "185.00",
        monthlyQuotaM3: "182000.00",
        annualQuotaM3: "2184000.00",
        plantedDaysAgo: 820,
        expectedHarvestInDays: 110,
        priorCropType: "fruits",
        priorCropLabel: "Dates",
        priorYieldKgPerAcre: "1260.00",
      },
      {
        name: "Darb El Arbaeen Wheat Fields",
        cropType: "wheat",
        cropLabel: "Wheat",
        growthStage: "maturity",
        targetSoilMoisturePct: "24.00",
        totalAreaAcres: "240.00",
        monthlyQuotaM3: "164000.00",
        annualQuotaM3: "1968000.00",
        plantedDaysAgo: 110,
        expectedHarvestInDays: 18,
        priorCropType: "other",
        priorCropLabel: "Alfalfa",
        priorYieldKgPerAcre: "940.00",
      },
      {
        name: "South Kharga Fodder Cluster",
        cropType: "other",
        cropLabel: "Alfalfa",
        growthStage: "vegetative",
        targetSoilMoisturePct: "36.00",
        totalAreaAcres: "150.00",
        monthlyQuotaM3: "171000.00",
        annualQuotaM3: "2052000.00",
        plantedDaysAgo: 48,
        expectedHarvestInDays: 22,
        priorCropType: "wheat",
        priorCropLabel: "Wheat",
        priorYieldKgPerAcre: "890.00",
      },
    ],
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
    farms: [
      {
        name: "Mut Oasis Orchard",
        cropType: "fruits",
        cropLabel: "Dates and citrus",
        growthStage: "fruiting",
        targetSoilMoisturePct: "30.00",
        totalAreaAcres: "172.00",
        monthlyQuotaM3: "169000.00",
        annualQuotaM3: "2028000.00",
        plantedDaysAgo: 730,
        expectedHarvestInDays: 95,
        priorCropType: "fruits",
        priorCropLabel: "Dates",
        priorYieldKgPerAcre: "1180.00",
      },
      {
        name: "Qasr Wheat Basin",
        cropType: "wheat",
        cropLabel: "Wheat",
        growthStage: "maturity",
        targetSoilMoisturePct: "23.50",
        totalAreaAcres: "225.00",
        monthlyQuotaM3: "158000.00",
        annualQuotaM3: "1896000.00",
        plantedDaysAgo: 118,
        expectedHarvestInDays: 20,
        priorCropType: "corn",
        priorCropLabel: "Maize",
        priorYieldKgPerAcre: "1015.00",
      },
      {
        name: "West Dakhla Vegetable Belt",
        cropType: "vegetables",
        cropLabel: "Tomato and pepper rotation",
        growthStage: "flowering",
        targetSoilMoisturePct: "38.00",
        totalAreaAcres: "132.00",
        monthlyQuotaM3: "143000.00",
        annualQuotaM3: "1716000.00",
        plantedDaysAgo: 52,
        expectedHarvestInDays: 34,
        priorCropType: "vegetables",
        priorCropLabel: "Onion",
        priorYieldKgPerAcre: "1320.00",
      },
    ],
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
    farms: [
      {
        name: "Farafra Desert Wheat Cooperative",
        cropType: "wheat",
        cropLabel: "Wheat",
        growthStage: "maturity",
        targetSoilMoisturePct: "22.50",
        totalAreaAcres: "255.00",
        monthlyQuotaM3: "176000.00",
        annualQuotaM3: "2112000.00",
        plantedDaysAgo: 120,
        expectedHarvestInDays: 16,
        priorCropType: "other",
        priorCropLabel: "Alfalfa",
        priorYieldKgPerAcre: "920.00",
      },
      {
        name: "Abu Minqar Vegetable Cluster",
        cropType: "vegetables",
        cropLabel: "Potato and onion rotation",
        growthStage: "vegetative",
        targetSoilMoisturePct: "37.00",
        totalAreaAcres: "142.00",
        monthlyQuotaM3: "151000.00",
        annualQuotaM3: "1812000.00",
        plantedDaysAgo: 46,
        expectedHarvestInDays: 39,
        priorCropType: "vegetables",
        priorCropLabel: "Potato",
        priorYieldKgPerAcre: "1410.00",
      },
      {
        name: "Farafra Palm Grove",
        cropType: "fruits",
        cropLabel: "Date palms",
        growthStage: "fruiting",
        targetSoilMoisturePct: "30.00",
        totalAreaAcres: "164.00",
        monthlyQuotaM3: "162000.00",
        annualQuotaM3: "1944000.00",
        plantedDaysAgo: 910,
        expectedHarvestInDays: 108,
        priorCropType: "fruits",
        priorCropLabel: "Dates",
        priorYieldKgPerAcre: "1195.00",
      },
    ],
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
    farms: [
      {
        name: "Paris Oasis Wheat Farms",
        cropType: "wheat",
        cropLabel: "Wheat",
        growthStage: "maturity",
        targetSoilMoisturePct: "24.00",
        totalAreaAcres: "205.00",
        monthlyQuotaM3: "148000.00",
        annualQuotaM3: "1776000.00",
        plantedDaysAgo: 112,
        expectedHarvestInDays: 19,
        priorCropType: "corn",
        priorCropLabel: "Maize",
        priorYieldKgPerAcre: "980.00",
      },
      {
        name: "East Paris Date Gardens",
        cropType: "fruits",
        cropLabel: "Date palms",
        growthStage: "fruiting",
        targetSoilMoisturePct: "31.50",
        totalAreaAcres: "148.00",
        monthlyQuotaM3: "155000.00",
        annualQuotaM3: "1860000.00",
        plantedDaysAgo: 840,
        expectedHarvestInDays: 112,
        priorCropType: "fruits",
        priorCropLabel: "Dates",
        priorYieldKgPerAcre: "1175.00",
      },
      {
        name: "South Paris Vegetable Cluster",
        cropType: "vegetables",
        cropLabel: "Tomato and cucumber rotation",
        growthStage: "flowering",
        targetSoilMoisturePct: "39.00",
        totalAreaAcres: "126.00",
        monthlyQuotaM3: "140000.00",
        annualQuotaM3: "1680000.00",
        plantedDaysAgo: 54,
        expectedHarvestInDays: 33,
        priorCropType: "vegetables",
        priorCropLabel: "Tomato",
        priorYieldKgPerAcre: "1370.00",
      },
    ],
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
    farms: [
      {
        name: "Balat Date Gardens",
        cropType: "fruits",
        cropLabel: "Date palms",
        growthStage: "fruiting",
        targetSoilMoisturePct: "30.50",
        totalAreaAcres: "158.00",
        monthlyQuotaM3: "160000.00",
        annualQuotaM3: "1920000.00",
        plantedDaysAgo: 870,
        expectedHarvestInDays: 104,
        priorCropType: "fruits",
        priorCropLabel: "Dates",
        priorYieldKgPerAcre: "1210.00",
      },
      {
        name: "Balat Cereal Plains",
        cropType: "corn",
        cropLabel: "Maize",
        growthStage: "vegetative",
        targetSoilMoisturePct: "27.00",
        totalAreaAcres: "190.00",
        monthlyQuotaM3: "149000.00",
        annualQuotaM3: "1788000.00",
        plantedDaysAgo: 44,
        expectedHarvestInDays: 61,
        priorCropType: "wheat",
        priorCropLabel: "Wheat",
        priorYieldKgPerAcre: "955.00",
      },
      {
        name: "Balat Mixed Vegetable Holdings",
        cropType: "vegetables",
        cropLabel: "Okra and pepper rotation",
        growthStage: "flowering",
        targetSoilMoisturePct: "38.50",
        totalAreaAcres: "118.00",
        monthlyQuotaM3: "136000.00",
        annualQuotaM3: "1632000.00",
        plantedDaysAgo: 50,
        expectedHarvestInDays: 30,
        priorCropType: "vegetables",
        priorCropLabel: "Pepper",
        priorYieldKgPerAcre: "1345.00",
      },
    ],
  },
];

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

const CROP_TYPE_LOOKUPS: Array<{
  type: CropType;
  displayName: string;
  commonName: string;
  description: string;
}> = [
  {
    type: "wheat",
    displayName: "Wheat",
    commonName: "Bread wheat",
    description:
      "Strategic winter cereal crop widely cultivated in New Valley reclamation zones.",
  },
  {
    type: "rice",
    displayName: "Rice",
    commonName: "Rice",
    description:
      "Included for catalog completeness; not a primary crop in New Valley due to water intensity.",
  },
  {
    type: "corn",
    displayName: "Corn",
    commonName: "Maize",
    description:
      "Summer cereal used for grain and fodder production in oasis agriculture.",
  },
  {
    type: "cotton",
    displayName: "Cotton",
    commonName: "Cotton",
    description:
      "Legacy field crop available in catalog for expansion scenarios.",
  },
  {
    type: "sugarcane",
    displayName: "Sugarcane",
    commonName: "Sugarcane",
    description:
      "Catalog option; not a preferred crop for New Valley groundwater management.",
  },
  {
    type: "vegetables",
    displayName: "Vegetables",
    commonName: "Onion, tomato, pepper, potato",
    description:
      "High-value horticulture under irrigated oasis production systems.",
  },
  {
    type: "fruits",
    displayName: "Fruits",
    commonName: "Date palms, citrus, pomegranate",
    description:
      "Represents perennial orchard systems, especially date palms across the governorate.",
  },
  {
    type: "other",
    displayName: "Other",
    commonName: "Alfalfa and fodder crops",
    description:
      "Used for fodder systems such as alfalfa where no dedicated enum exists.",
  },
];

const GROWTH_STAGE_LOOKUPS: Array<{
  stage: GrowthStage;
  displayName: string;
  description: string;
  estDurationDays: number;
}> = [
  {
    stage: "germination",
    displayName: "Germination",
    description: "Emergence and establishment stage.",
    estDurationDays: 14,
  },
  {
    stage: "vegetative",
    displayName: "Vegetative",
    description: "Leaf and canopy expansion stage.",
    estDurationDays: 35,
  },
  {
    stage: "flowering",
    displayName: "Flowering",
    description: "Reproductive transition and bloom stage.",
    estDurationDays: 20,
  },
  {
    stage: "fruiting",
    displayName: "Fruiting",
    description:
      "Fruit set and development stage for orchard and horticulture crops.",
    estDurationDays: 60,
  },
  {
    stage: "maturity",
    displayName: "Maturity",
    description: "Final grain or fruit fill before harvest.",
    estDurationDays: 25,
  },
  {
    stage: "harvest",
    displayName: "Harvest",
    description: "Ready for harvest or post-harvest completion state.",
    estDurationDays: 7,
  },
];

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

const WELLS_PER_DISTRICT = 10;
const READING_INTERVAL_MINUTES = 60;
const HISTORY_HOURS = 8760;

function gaussianRandom(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stddev;
}

function generateApiKeyRaw(): string {
  return randomBytes(32).toString("hex");
}

function hashApiKeySync(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildNationalId(seedNumber: number): string {
  return `298010101${seedNumber.toString().padStart(5, "0")}`.slice(0, 14);
}

function splitEvenly<T>(items: T[], groups: number): T[][] {
  const result = Array.from({ length: groups }, () => [] as T[]);
  for (const [index, item] of items.entries()) {
    result[index % groups]!.push(item);
  }
  return result;
}

async function cleanupExistingSeedData() {
  console.log("  Removing previous seed data...");

  const districtNames = [
    ...new Set([
      ...LEGACY_SEED_DISTRICT_NAMES,
      ...DISTRICTS.map((district) => district.name),
    ]),
  ];

  const seededDistricts = await db
    .select({ id: schema.district.id })
    .from(schema.district)
    .where(inArray(schema.district.name, districtNames));

  const districtIds = seededDistricts.map((district) => district.id);

  const seededUsers = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(sql`${schema.user.email} like ${`%@${SEED_EMAIL_DOMAIN}`}`);

  const userIds = seededUsers.map((user) => user.id);

  let wellIds: string[] = [];
  let sensorIds: string[] = [];
  let farmIds: string[] = [];

  if (districtIds.length > 0) {
    const seededWells = await db
      .select({ id: schema.well.id })
      .from(schema.well)
      .where(inArray(schema.well.districtId, districtIds));
    wellIds = seededWells.map((well) => well.id);

    const seededFarms = await db
      .select({ id: schema.farm.id })
      .from(schema.farm)
      .where(inArray(schema.farm.districtId, districtIds));
    farmIds = seededFarms.map((farm) => farm.id);
  }

  if (wellIds.length > 0) {
    const seededSensors = await db
      .select({ id: schema.sensors.id })
      .from(schema.sensors)
      .where(inArray(schema.sensors.wellId, wellIds));
    sensorIds = seededSensors.map((sensor) => sensor.id);
  }

  if (sensorIds.length > 0) {
    await db
      .delete(schema.alerts)
      .where(inArray(schema.alerts.sensorId, sensorIds));
    await db
      .delete(schema.latestSensorState)
      .where(inArray(schema.latestSensorState.sensorId, sensorIds));
    await db
      .delete(schema.sensorData)
      .where(inArray(schema.sensorData.sensorId, sensorIds));
  }

  if (wellIds.length > 0) {
    await db
      .delete(schema.apiKey)
      .where(inArray(schema.apiKey.wellId, wellIds));
    await db
      .delete(schema.alertRule)
      .where(inArray(schema.alertRule.wellId, wellIds));
    await db
      .delete(schema.wellStatusHistory)
      .where(inArray(schema.wellStatusHistory.wellId, wellIds));
  }

  if (farmIds.length > 0) {
    await db
      .delete(schema.cropHistory)
      .where(inArray(schema.cropHistory.farmId, farmIds));
    await db
      .delete(schema.cropProfile)
      .where(inArray(schema.cropProfile.farmId, farmIds));
    await db
      .delete(schema.farmWell)
      .where(inArray(schema.farmWell.farmId, farmIds));
    await db.delete(schema.farm).where(inArray(schema.farm.id, farmIds));
  }

  if (sensorIds.length > 0) {
    await db
      .delete(schema.sensors)
      .where(inArray(schema.sensors.id, sensorIds));
  }

  if (wellIds.length > 0) {
    await db.delete(schema.well).where(inArray(schema.well.id, wellIds));
  }

  if (districtIds.length > 0) {
    await db
      .delete(schema.district)
      .where(inArray(schema.district.id, districtIds));
  }

  if (userIds.length > 0) {
    await db
      .delete(schema.userProfile)
      .where(inArray(schema.userProfile.userId, userIds));
    await db
      .delete(schema.userRoleAssignment)
      .where(inArray(schema.userRoleAssignment.userId, userIds));
    await db.delete(schema.user).where(inArray(schema.user.id, userIds));
  }

  console.log(
    `  Cleanup removed districts:${districtIds.length} wells:${wellIds.length} sensors:${sensorIds.length} farms:${farmIds.length} users:${userIds.length}`,
  );
}

async function seedRoles() {
  console.log("  Seeding role catalog...");
  for (const roleSeed of ROLE_CATALOG) {
    await db.insert(schema.role).values(roleSeed).onConflictDoNothing();
  }
}

async function seedLookupCatalogs() {
  console.log("  Seeding crop and growth catalogs...");
  for (const cropType of CROP_TYPE_LOOKUPS) {
    await db
      .insert(schema.cropTypeLookup)
      .values(cropType)
      .onConflictDoNothing();
  }
  for (const stage of GROWTH_STAGE_LOOKUPS) {
    await db
      .insert(schema.growthStageLookup)
      .values(stage)
      .onConflictDoNothing();
  }
}

async function seedAdminUser() {
  console.log("  Finding existing admin user...");
  // Use the nationalId/username from src/server/db/seed.ts or its variant
  const adminUsername = "12345678901234"; 

  const [adminUser] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.username, adminUsername))
    .limit(1);

  if (!adminUser) {
    throw new Error(`CRITICAL: Admin user "${adminUsername}" not found. You must run "npx tsx src/server/db/seed.ts" first to create the primary system admin.`);
  } else {
    SEED_ADMIN_ID = adminUser.id;
    console.log(`    Admin found: ${SEED_ADMIN_ID}`);
  }

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
}

async function seedDistricts(): Promise<
  Array<{ id: string; seed: DistrictSeed }>
> {
  console.log("  Seeding districts...");
  const records: Array<{ id: string; seed: DistrictSeed }> = [];

  for (const districtSeed of DISTRICTS) {
    const [districtRecord] = await db
      .insert(schema.district)
      .values({
        name: districtSeed.name,
        baselineDepthM: districtSeed.baselineDepthM,
        annualDepletionRateM: districtSeed.annualDepletionRateM,
        safeYieldM3Yr: districtSeed.safeYieldM3Yr,
        warningThresholdPct: districtSeed.warningThresholdPct,
        criticalThresholdPct: districtSeed.criticalThresholdPct,
      })
      .returning({ id: schema.district.id });

    if (!districtRecord) {
      throw new Error(`Failed to insert district ${districtSeed.name}`);
    }

    records.push({ id: districtRecord.id, seed: districtSeed });
    console.log(`    District: "${districtSeed.name}" → ${districtRecord.id}`);
  }

  return records;
}

async function seedWells(
  districtRecords: Array<{ id: string; seed: DistrictSeed }>,
): Promise<Array<{ wellId: string; sensorIds: string[]; districtId: string }>> {
  console.log("  Seeding wells, sensors, and historical readings...");
  const allWells: Array<{
    wellId: string;
    sensorIds: string[];
    districtId: string;
  }> = [];

  for (const districtRecord of districtRecords) {
    for (let wellIndex = 1; wellIndex <= WELLS_PER_DISTRICT; wellIndex++) {
      const lat = districtRecord.seed.centerLat + (Math.random() - 0.5) * 0.18;
      const lng = districtRecord.seed.centerLng + (Math.random() - 0.5) * 0.18;
      const baselineDepth = Number(districtRecord.seed.baselineDepthM);

      const [wellRecord] = await db
        .insert(schema.well)
        .values({
          districtId: districtRecord.id,
          name: `${districtRecord.seed.name} Well ${wellIndex.toString().padStart(2, "0")}`,
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

      if (!wellRecord)
        throw new Error(
          `Failed to insert well ${districtRecord.seed.name} ${wellIndex}`,
        );

      await db.insert(schema.wellStatusHistory).values({
        wellId: wellRecord.id,
        changedBy: SEED_ADMIN_ID,
        fromStatus: null,
        toStatus: "active",
        reason: "Initial regional seed",
      });

      const sensorIds: string[] = [];
      for (const spec of SENSOR_SPECS) {
        const [sensorRecord] = await db
          .insert(schema.sensors)
          .values({
            wellId: wellRecord.id,
            type: spec.type,
            unit: spec.unit,
            name: spec.name,
            description: `${districtRecord.seed.name} ${spec.name}`,
            isActive: true,
          })
          .returning({ id: schema.sensors.id });

        if (!sensorRecord)
          throw new Error(
            `Failed to create sensor ${spec.name} for ${wellRecord.id}`,
          );
        sensorIds.push(sensorRecord.id);
      }

      await db
        .update(schema.well)
        .set({ hasSensor: true })
        .where(eq(schema.well.id, wellRecord.id));

      const now = new Date();
      const readings: Array<{
        sensorId: string;
        value: number;
        timestamp: Date;
      }> = [];
      for (let sensorIndex = 0; sensorIndex < sensorIds.length; sensorIndex++) {
        const spec = SENSOR_SPECS[sensorIndex]!;
        const sensorId = sensorIds[sensorIndex]!;
        const totalReadings = (HISTORY_HOURS * 60) / READING_INTERVAL_MINUTES;
        for (let tick = totalReadings; tick >= 0; tick--) {
          const timestamp = new Date(
            now.getTime() - tick * READING_INTERVAL_MINUTES * 60_000,
          );
          const isAnomaly = Math.random() < 0.05;
          const value = isAnomaly
            ? spec.mean + (Math.random() > 0.5 ? 1 : -1) * spec.stddev * 4
            : gaussianRandom(spec.mean, spec.stddev);
          readings.push({ sensorId, value: Math.max(0, value), timestamp });
        }
      }

      const chunkSize = 1000;
      for (
        let chunkIndex = 0;
        chunkIndex < readings.length;
        chunkIndex += chunkSize
      ) {
        await db
          .insert(schema.sensorData)
          .values(readings.slice(chunkIndex, chunkIndex + chunkSize));
      }

      for (let sensorIndex = 0; sensorIndex < sensorIds.length; sensorIndex++) {
        const spec = SENSOR_SPECS[sensorIndex]!;
        const sensorId = sensorIds[sensorIndex]!;
        await db.insert(schema.latestSensorState).values({
          sensorId,
          wellId: wellRecord.id,
          value: gaussianRandom(spec.mean, spec.stddev),
          unit: spec.unit,
          type: spec.type,
          lastUpdatedAt: now,
        });
      }

      await db.insert(schema.alertRule).values([
        {
          wellId: wellRecord.id,
          sensorType: "water_level",
          operator: "lt",
          threshold: 5,
          severity: "critical",
          suppressionWindowMinutes: 30,
          isActive: true,
          createdByUserId: SEED_ADMIN_ID,
        },
        {
          wellId: wellRecord.id,
          sensorType: "flow_rate",
          operator: "gt",
          threshold: 8,
          severity: "warning",
          suppressionWindowMinutes: 15,
          isActive: true,
          createdByUserId: SEED_ADMIN_ID,
        },
        {
          wellId: wellRecord.id,
          sensorType: "pressure",
          operator: "gt",
          threshold: 3.5,
          severity: "warning",
          suppressionWindowMinutes: 15,
          isActive: true,
          createdByUserId: SEED_ADMIN_ID,
        },
      ]);

      allWells.push({
        wellId: wellRecord.id,
        sensorIds,
        districtId: districtRecord.id,
      });
    }
  }

  return allWells;
}

async function createRegionalUser(args: {
  fullName: string;
  districtId: string;
  nationalIdSeed: number;
  roleType: "farm_owner" | "farmer";
}) {
  const nationalId = buildNationalId(args.nationalIdSeed);
  const slug = slugify(args.fullName);
  const identitySuffix = args.nationalIdSeed.toString().padStart(3, "0");
  const email = `${slug}_${identitySuffix}@${SEED_EMAIL_DOMAIN}`;

  const { auth } = await import("../src/server/better-auth/config");

  if (!auth?.api) {
    throw new Error("Better Auth API not initialized.");
  }

  try {
    // Check if user already exists first to avoid unnecessary auth calls
    const existing = await db.query.user.findFirst({
        where: (u, { eq }) => eq(u.username, nationalId)
    });

    if (!existing) {
        // Create via Better Auth API
        // @ts-ignore
        const signUp = auth.api.signUpUsername || (auth.api.signUp && auth.api.signUp.username) || auth.api.signUpEmail;
        
        if (signUp) {
            await signUp({
              body: {
                name: args.fullName,
                username: nationalId,
                email: email,
                password: "password123",
              },
            });
        } else {
            throw new Error(`CRITICAL: Could not find sign-up method on auth.api for ${nationalId}. Seeding aborted to prevent creating unauthenticated users.`);
        }
    }
  } catch (e: any) {
    if (!e.message?.includes("already exists") && e.code !== "USER_ALREADY_EXISTS") {
      console.error(`    Error creating user ${nationalId}:`, e.message);
    }
  }

  const [userRecord] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.username, nationalId))
    .limit(1);

  if (!userRecord) {
    throw new Error(`User not found after creation: ${nationalId}`);
  }

  const userId = userRecord.id;

  // Add/Update user profile
  await db.insert(schema.userProfile).values({
    userId,
    nationalId,
    fullName: args.fullName,
    phoneNumber: `+2010${args.nationalIdSeed.toString().padStart(8, "0")}`.slice(0, 14),
    districtId: args.districtId,
    isActive: true,
  }).onConflictDoUpdate({
    target: schema.userProfile.userId,
    set: {
      nationalId,
      fullName: args.fullName,
      districtId: args.districtId,
    }
  });

  const [roleRecord] = await db
    .select({ id: schema.role.id })
    .from(schema.role)
    .where(eq(schema.role.type, args.roleType))
    .limit(1);

  if (!roleRecord) throw new Error(`Role not found: ${args.roleType}`);

  await db.insert(schema.userRoleAssignment).values({
    userId,
    roleId: roleRecord.id,
    assignedBy: SEED_ADMIN_ID,
  }).onConflictDoNothing();

  return { userId };
}

async function seedFarmsAndCrops(
  districtRecords: Array<{ id: string; seed: DistrictSeed }>,
  wells: Array<{ wellId: string; sensorIds: string[]; districtId: string }>,
) {
  console.log("  Seeding farms, farm owners, and crop profiles...");
  let farmCount = 0;

  for (const [districtIndex, districtRecord] of districtRecords.entries()) {
    const districtWells = wells.filter(
      (well) => well.districtId === districtRecord.id,
    );
    const wellGroups = splitEvenly(
      districtWells,
      districtRecord.seed.farms.length,
    );

    for (const [farmIndex, farmSeed] of districtRecord.seed.farms.entries()) {
      const owner = await createRegionalUser({
        fullName: `${farmSeed.name} Owner`,
        districtId: districtRecord.id,
        nationalIdSeed: districtIndex * 100 + farmIndex * 2 + 1,
        roleType: "farm_owner",
      });

      const farmer = await createRegionalUser({
        fullName: `${farmSeed.name} Operator`,
        districtId: districtRecord.id,
        nationalIdSeed: districtIndex * 100 + farmIndex * 2 + 2,
        roleType: "farmer",
      });

      const now = new Date();
      const plantedDate = new Date(
        now.getTime() - farmSeed.plantedDaysAgo * 24 * 60 * 60_000,
      );
      const expectedHarvestDate = new Date(
        now.getTime() + farmSeed.expectedHarvestInDays * 24 * 60 * 60_000,
      );

      const [farmRecord] = await db
        .insert(schema.farm)
        .values({
          name: farmSeed.name,
          ownerId: owner.userId,
          farmerUserId: farmer.userId,
          districtId: districtRecord.id,
          status: "active",
          totalAreaAcres: farmSeed.totalAreaAcres,
          monthlyQuotaM3: farmSeed.monthlyQuotaM3,
          annualQuotaM3: farmSeed.annualQuotaM3,
          lastProfileUpdated: now,
        })
        .returning({ id: schema.farm.id });

      if (!farmRecord)
        throw new Error(`Failed to create farm ${farmSeed.name}`);

      const assignedWells = wellGroups[farmIndex] ?? [];
      if (assignedWells.length > 0) {
        const allocation = (100 / assignedWells.length).toFixed(2);
        await db.insert(schema.farmWell).values(
          assignedWells.map((assignedWell) => ({
            farmId: farmRecord.id,
            wellId: assignedWell.wellId,
            allocationPct: allocation,
          })),
        );
      }

      await db.insert(schema.cropProfile).values({
        farmId: farmRecord.id,
        cropType: farmSeed.cropType,
        growthStage: farmSeed.growthStage,
        targetSoilMoisturePct: farmSeed.targetSoilMoisturePct,
        plantedDate,
        expectedHarvestDate,
      });

      await db.insert(schema.cropHistory).values({
        farmId: farmRecord.id,
        cropType: farmSeed.priorCropType,
        growthStage: "harvest",
        targetSoilMoisturePct: farmSeed.targetSoilMoisturePct,
        plantedDate: new Date(plantedDate.getTime() - 120 * 24 * 60 * 60_000),
        harvestedDate: new Date(plantedDate.getTime() - 15 * 24 * 60 * 60_000),
        yield: farmSeed.priorYieldKgPerAcre,
        yieldUnit: `${farmSeed.priorCropLabel} kg_per_acre`,
      });

      farmCount += 1;
    }
  }

  return farmCount;
}

async function seedApiKeys(
  wells: Array<{ wellId: string; sensorIds: string[]; districtId: string }>,
  districtRecords: Array<{ id: string; seed: DistrictSeed }>,
) {
  console.log("  Generating demo API keys...");
  const keys: Array<{ name: string; rawKey: string }> = [];

  for (const districtRecord of districtRecords) {
    const districtWell = wells.find(
      (well) => well.districtId === districtRecord.id,
    );
    if (!districtWell) continue;

    const rawKey = generateApiKeyRaw();
    await db.insert(schema.apiKey).values({
      hashedKey: hashApiKeySync(rawKey),
      name: `Demo IoT Key — ${districtRecord.seed.name}`,
      wellId: districtWell.wellId,
      createdByUserId: SEED_ADMIN_ID,
      isActive: true,
    });

    keys.push({ name: `Demo IoT Key — ${districtRecord.seed.name}`, rawKey });
  }

  console.log("\n  ┌─────────────────────────────────────────────────────┐");
  console.log("  │  DEMO API KEYS (save these — shown only once)       │");
  console.log("  └─────────────────────────────────────────────────────┘");
  for (const key of keys) {
    console.log(`  ${key.name}:`);
    console.log(`    ${key.rawKey}\n`);
  }
}

async function main() {
  console.log("🌱 AqwaValley regional seed starting...\n");

  await cleanupExistingSeedData();
  await seedRoles();
  await seedLookupCatalogs();
  await seedAdminUser();

  const districtRecords = await seedDistricts();
  const wells = await seedWells(districtRecords);
  const farmCount = await seedFarmsAndCrops(districtRecords, wells);
  await seedApiKeys(wells, districtRecords);

  console.log("\n✅ Seed complete.");
  console.log(`   Districts: ${districtRecords.length}`);
  console.log(`   Wells: ${wells.length}`);
  console.log(`   Farms: ${farmCount}`);
  console.log(`   Sensors: ${wells.length * SENSOR_SPECS.length}`);
  console.log(
    `   Readings: ~${wells.length * SENSOR_SPECS.length * ((HISTORY_HOURS * 60) / READING_INTERVAL_MINUTES)}`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => queryClient.end());
