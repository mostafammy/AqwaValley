import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local synchronously before any other imports
const envLocalPath = resolve(process.cwd(), ".env.local");
try {
  const envContent = readFileSync(envLocalPath, "utf-8");
  const lines = envContent.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    
    const key = trimmed.substring(0, equalsIndex).trim();
    let value = trimmed.substring(equalsIndex + 1).trim();
    
    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
} catch (error) {
  console.warn("Warning: Could not load .env.local file");
}

// Now import the project modules after environment is set
import { resolveProviderInputsForRun } from "~/server/services/irrigation/providerResolver";
import { hashCanonical } from "~/server/services/irrigation/simulationHashing";

async function testMissingProviderMapping(): Promise<void> {
  const result = await resolveProviderInputsForRun({
    farmId: randomUUID(),
    districtId: "test-district",
    at: new Date("2026-01-01T00:00:00.000Z"),
  });

  assert.equal(result.ok, false, "Expected missing crop profile to fail mapping.");
  if (result.ok) return;
  assert.equal(result.error.code, "MISSING_MAPPING");
}

function testHashStabilityForSameEnvelope(): void {
  const envelope = {
    farmId: "farm-1",
    irrigationEventId: "event-1",
    wellIds: ["well-2", "well-1"],
    durationMinutes: 30,
    areaM2: 4046.8564,
    startTimestamp: "2026-01-01T00:00:00.000Z",
    baseFlowRateM3s: 0.02,
  };

  const hashA = hashCanonical(envelope);
  const hashB = hashCanonical({
    ...envelope,
  });

  assert.equal(hashA, hashB, "Input envelope hash should be deterministic.");
}

function testProviderSnapshotHashDivergence(): void {
  const baseSnapshot = {
    weather: {
      et0_value_si: 0.00000009,
      source: "climatology",
      freshness: "STALE",
      age_minutes: 1440,
      provider_timestamp: "2026-01-01T00:00:00.000Z",
      provider_version: "weather_stub_v1",
    },
    crop: {
      crop_type: "wheat",
      growth_stage: "vegetative",
      kc_value: 0.7,
      stress_coefficient: 0.9,
      provider_version: "crop_profile_v1",
    },
    soil: {
      soil_type: "wheat",
      ks_value_si: 0.00045,
      field_capacity_depth_m: 0.75,
      provider_version: "soil_profile_v1",
    },
  };

  const changedSnapshot = {
    ...baseSnapshot,
    weather: {
      ...baseSnapshot.weather,
      source: "live_api",
      freshness: "FRESH",
      age_minutes: 3,
    },
  };

  const baseHash = hashCanonical(baseSnapshot);
  const changedHash = hashCanonical(changedSnapshot);

  assert.notEqual(
    baseHash,
    changedHash,
    "Provider snapshot hash must change when source/freshness changes.",
  );
}

async function main(): Promise<void> {
  await testMissingProviderMapping();
  testHashStabilityForSameEnvelope();
  testProviderSnapshotHashDivergence();
  console.log("replay/diff integration checks passed");
}

main().catch((error) => {
  console.error("replay/diff integration checks failed", error);
  process.exit(1);
});
