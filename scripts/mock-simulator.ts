#!/usr/bin/env tsx
/**
 * scripts/mock-simulator.ts
 *
 * Continuous mock IoT simulator — posts sensor readings to the ingest REST
 * endpoint at configurable intervals. Reads API keys from env or accepts them
 * as CLI arguments.
 *
 * Usage:
 *   MOCK_API_KEY=<key> MOCK_BASE_URL=http://localhost:3000 pnpm mock:simulator
 *   # or with multiple keys (comma-separated):
 *   MOCK_API_KEYS=<key1>,<key2> pnpm mock:simulator
 */

import { existsSync, readFileSync } from "fs";

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
// Configuration
// ---------------------------------------------------------------------------
const BASE_URL = process.env.MOCK_BASE_URL ?? "http://localhost:3000";
const INTERVAL_MS = parseInt(process.env.MOCK_INTERVAL_MS ?? "5000", 10);
const ANOMALY_RATE = parseFloat(process.env.MOCK_ANOMALY_RATE ?? "0.05");

const rawApiKeys = (process.env.MOCK_API_KEYS ?? process.env.MOCK_API_KEY ?? "").split(",").filter(Boolean);

if (rawApiKeys.length === 0) {
  console.error(
    "ERROR: Set MOCK_API_KEY or MOCK_API_KEYS env variable with one or more API keys.",
  );
  process.exit(1);
}

// Per-key mock state (tracks sensorId → current simulated value)
const sensorState = new Map<string, { mean: number; stddev: number; value: number }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function gaussianRandom(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z0 * stddev;
}

function nextValue(sensorId: string, type: string): number {
  if (!sensorState.has(sensorId)) {
    const defaults: Record<string, { mean: number; stddev: number }> = {
      water_level: { mean: 12.5, stddev: 0.8 },
      flow_rate: { mean: 4.2, stddev: 0.5 },
      pressure: { mean: 2.1, stddev: 0.15 },
      temperature: { mean: 22.0, stddev: 2.0 },
      humidity: { mean: 55.0, stddev: 5.0 },
    };
    const spec = defaults[type] ?? { mean: 10, stddev: 1 };
    sensorState.set(sensorId, { ...spec, value: gaussianRandom(spec.mean, spec.stddev) });
  }

  const state = sensorState.get(sensorId)!;

  // Drift the value slightly toward mean
  const drift = (state.mean - state.value) * 0.05;
  const noise = gaussianRandom(0, state.stddev * 0.3);
  const isAnomaly = Math.random() < ANOMALY_RATE;

  state.value = isAnomaly
    ? state.mean + (Math.random() > 0.5 ? 1 : -1) * state.stddev * 5
    : state.value + drift + noise;

  return Math.max(0, state.value);
}

// ---------------------------------------------------------------------------
// Fetch sensor list for a well-scoped key by calling the ingest probe
// We use a discovery pattern: POST a dummy reading to get back sensor info.
// Instead, we maintain a simple list retrieved once at startup.
// ---------------------------------------------------------------------------
type SensorInfo = { sensorId: string; type: string };

async function discoverSensors(apiKey: string): Promise<SensorInfo[]> {
  // The simulator posts to a discovery endpoint. If one doesn't exist, 
  // it falls back to a pre-configured sensor list via env.
  const preconfig = process.env.MOCK_SENSOR_IDS;
  if (preconfig) {
    return preconfig.split(",").map((pair) => {
      const [sensorId = "", type = "water_level"] = pair.split(":");
      return { sensorId, type };
    });
  }

  // Try the health + a probe-style GET to get sensor list
  // Fall back to using a single sensor from MOCK_SENSOR_ID
  const singleSensorId = process.env.MOCK_SENSOR_ID;
  const singleSensorType = process.env.MOCK_SENSOR_TYPE ?? "water_level";
  if (singleSensorId) {
    return [{ sensorId: singleSensorId, type: singleSensorType }];
  }

  console.warn(
    `[${apiKey.slice(0, 8)}...] No sensors configured. Set MOCK_SENSOR_IDS=<id>:<type>,... or MOCK_SENSOR_ID=<id>`,
  );
  return [];
}

// ---------------------------------------------------------------------------
// Send a batch of readings for one API key's sensors
// ---------------------------------------------------------------------------
async function sendReadings(apiKey: string, sensors: SensorInfo[]): Promise<void> {
  if (sensors.length === 0) return;

  const now = new Date().toISOString();
  const readings = sensors.map(({ sensorId, type }) => ({
    sensorId,
    value: nextValue(sensorId, type),
    timestamp: now,
  }));

  try {
    const res = await fetch(`${BASE_URL}/api/sensors/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ readings }),
    });

    const body = (await res.json()) as { accepted?: number; rejected?: number; error?: string };

    if (!res.ok) {
      console.error(`[${apiKey.slice(0, 8)}...] HTTP ${res.status}: ${body.error ?? "unknown error"}`);
      return;
    }

    console.log(
      `[${new Date().toISOString()}] key:${apiKey.slice(0, 8)}... accepted:${body.accepted ?? 0} rejected:${body.rejected ?? 0}`,
    );
  } catch (err) {
    console.error(`[${apiKey.slice(0, 8)}...] Network error:`, (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
async function main() {
  console.log(`🚀 AqwaValley mock simulator`);
  console.log(`   Base URL  : ${BASE_URL}`);
  console.log(`   Interval  : ${INTERVAL_MS}ms`);
  console.log(`   Anomaly % : ${(ANOMALY_RATE * 100).toFixed(0)}%`);
  console.log(`   API keys  : ${rawApiKeys.length}\n`);

  // Discover sensors for each key once
  const keySensors = await Promise.all(
    rawApiKeys.map(async (key) => ({
      key,
      sensors: await discoverSensors(key),
    })),
  );

  for (const { key, sensors } of keySensors) {
    console.log(`  Key ${key.slice(0, 8)}...: ${sensors.length} sensor(s) configured`);
  }
  console.log();

  // Tick loop
  async function tick() {
    await Promise.all(
      keySensors.map(({ key, sensors }) => sendReadings(key, sensors)),
    );
  }

  await tick(); // Run immediately on start
  const interval = setInterval(tick, INTERVAL_MS);

  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log("\nSimulator stopped.");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Simulator error:", err);
  process.exit(1);
});
