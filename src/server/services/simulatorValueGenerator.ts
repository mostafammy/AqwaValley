import { createHash } from "crypto";

import { env } from "~/env";

const BASELINES: Record<
  string,
  { mean: number; stddev: number; min: number; max: number }
> = {
  water_level: { mean: 12.5, stddev: 0.8, min: 1, max: 250 },
  flow_rate: { mean: 4.2, stddev: 0.5, min: 0, max: 200 },
  pressure: { mean: 2.1, stddev: 0.15, min: 0, max: 40 },
  temperature: { mean: 22, stddev: 2, min: -10, max: 80 },
  humidity: { mean: 55, stddev: 5, min: 0, max: 100 },
};

function hashToUnitFloat(key: string): number {
  const hash = createHash("sha256").update(key).digest();
  const int = hash.readUInt32BE(0);
  return int / 0xffffffff;
}

function gaussianFromUniformPair(u1: number, u2: number): number {
  const n1 = Math.max(u1, 1e-12);
  return Math.sqrt(-2 * Math.log(n1)) * Math.cos(2 * Math.PI * u2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function generateSimulatorValue(params: {
  sensorId: string;
  sensorType: string;
  timestamp: Date;
  anomalyRate?: number;
}): number {
  const baseline = BASELINES[params.sensorType] ?? {
    mean: 10,
    stddev: 1,
    min: 0,
    max: 100,
  };

  const minuteBucket = Math.floor(params.timestamp.getTime() / 60_000);
  const seedBase = `${params.sensorId}:${minuteBucket}`;

  const u1 = hashToUnitFloat(`${seedBase}:u1`);
  const u2 = hashToUnitFloat(`${seedBase}:u2`);
  const cycle = Math.sin((2 * Math.PI * params.timestamp.getUTCHours()) / 24);

  const gaussianNoise =
    gaussianFromUniformPair(u1, u2) * baseline.stddev * 0.35;
  const drift = cycle * baseline.stddev * 0.4;

  const anomalyRate = params.anomalyRate ?? env.SIM_DEFAULT_ANOMALY_RATE;
  const anomalySignal = hashToUnitFloat(`${seedBase}:anomaly`);
  const anomalyDirection = hashToUnitFloat(`${seedBase}:dir`) > 0.5 ? 1 : -1;

  const anomalyShift =
    anomalySignal < anomalyRate ? anomalyDirection * baseline.stddev * 5 : 0;

  const value = baseline.mean + gaussianNoise + drift + anomalyShift;
  return clamp(Number(value.toFixed(3)), baseline.min, baseline.max);
}
