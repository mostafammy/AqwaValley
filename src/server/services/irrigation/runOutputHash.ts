import { type PhysicsRunOutput } from "./simulation";
import { hashCanonical } from "./simulationHashing";

export function buildTrajectoryDigest(output: PhysicsRunOutput): Array<{
  t: string;
  e: number;
  wl: number;
  wd: number;
  dt: number;
  err: number;
}> {
  return output.samples.map((sample) => ({
    t: sample.timestamp.toISOString(),
    e: Number(sample.elapsedSeconds),
    wl: Number(sample.waterLevelM),
    wd: Number(sample.waterDebtM3),
    dt: Number(sample.dtUsedS),
    err: sample.errorNorm,
  }));
}

export function computeRunOutputHash(output: PhysicsRunOutput): string {
  return hashCanonical(buildTrajectoryDigest(output));
}
