import type {
  DrainageInput,
  ETcInput,
  IHydrologyModel,
  InflowInput,
} from "./contracts";
import { createDomainError, err, ok, type Result } from "./result";
import { asCubicMetersPerSecond, toNumber } from "./units";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class HydrologyModelV1 implements IHydrologyModel {
  public readonly version = "hydrology_v1.0.0";

  public computeETc(
    input: ETcInput,
  ): Result<ReturnType<typeof asCubicMetersPerSecond>> {
    const et0 = input.et0DepthRateMps;
    const kc = input.kc;
    const stress = toNumber(input.stressCoefficient);
    const area = toNumber(input.irrigatedAreaM2);

    if (!Number.isFinite(et0) || et0 < 0) {
      return err(
        createDomainError({
          code: "INVALID_INPUT",
          message: "ET0 depth rate must be a finite non-negative number.",
          retryable: false,
          context: { et0DepthRateMps: et0 },
        }),
      );
    }
    if (!Number.isFinite(kc) || kc <= 0 || kc > 2) {
      return err(
        createDomainError({
          code: "INVALID_INPUT",
          message: "Crop coefficient Kc must be in (0, 2].",
          retryable: false,
          context: { kc },
        }),
      );
    }

    return ok(
      asCubicMetersPerSecond(
        et0 * kc * stress * area,
        "etCubicMetersPerSecond",
      ),
    );
  }

  public computeDrainage(
    input: DrainageInput,
  ): Result<ReturnType<typeof asCubicMetersPerSecond>> {
    const drainageCoeff = input.drainageCoefficientPerSecond;
    const fieldCapacityDepth = toNumber(input.fieldCapacityDepthM);
    const waterLevel = toNumber(input.waterLevelM);
    const area = toNumber(input.irrigatedAreaM2);
    const dtS = toNumber(input.dtS);
    const maxDrainableVolume = toNumber(input.maxDrainableVolumeM3);

    if (!Number.isFinite(drainageCoeff) || drainageCoeff < 0) {
      return err(
        createDomainError({
          code: "INVALID_INPUT",
          message: "Drainage coefficient must be a finite non-negative number.",
          retryable: false,
          context: { drainageCoefficientPerSecond: drainageCoeff },
        }),
      );
    }

    const excessDepthM = Math.max(0, waterLevel - fieldCapacityDepth);
    const unconstrainedRate = drainageCoeff * excessDepthM * area;
    const maxRateByAvailability = dtS > 0 ? maxDrainableVolume / dtS : 0;
    const constrainedRate = clamp(unconstrainedRate, 0, maxRateByAvailability);

    return ok(asCubicMetersPerSecond(constrainedRate, "drainageM3s"));
  }

  public computeInflow(
    input: InflowInput,
  ): Result<ReturnType<typeof asCubicMetersPerSecond>> {
    if (!input.valveOpen) {
      return ok(asCubicMetersPerSecond(0, "inflowM3s"));
    }

    if (input.mode === "constant_flow") {
      const flow = input.constantFlowM3s ?? input.baseFlowRateM3s;
      return ok(asCubicMetersPerSecond(toNumber(flow), "inflowM3s"));
    }

    const nominalPressure = toNumber(input.nominalPressurePa);
    const pressure = toNumber(input.pressurePa);
    const baseFlow = toNumber(input.baseFlowRateM3s);

    if (nominalPressure <= 0) {
      return err(
        createDomainError({
          code: "INVALID_INPUT",
          message:
            "Nominal pressure must be > 0 for pressure-aware inflow mode.",
          retryable: false,
          context: { nominalPressurePa: nominalPressure },
        }),
      );
    }

    const pressureRatio = clamp(
      pressure / nominalPressure,
      0,
      Math.max(1, input.maxPressureMultiplier),
    );

    return ok(asCubicMetersPerSecond(baseFlow * pressureRatio, "inflowM3s"));
  }
}
