import {
  HydrologyModelV1,
  IrrigationPhysicsEngine,
  createDomainError,
  err,
  ok,
  resolveDerivativeTermsFromHydrologyModel,
  type PhysicsRunOutput,
  type Result,
} from "./simulation";
import {
  asCubicMeters,
  asCubicMetersPerSecond,
  asMeters,
  asPascals,
  asSeconds,
  asSquareMeters,
  asUnitInterval,
  toNumber,
} from "./simulation";

export type SimulateIrrigationRunInput = {
  startTimestamp: Date;
  horizonSeconds: number;
  areaM2: number;
  initialWaterLevelM: number;
  initialWaterDebtM3?: number;
  initialDtS?: number;
  minDtS?: number;
  maxDtS?: number;
  absTolM?: number;
  relTol?: number;
  maxRefinementsPerStep?: number;
  maxDryDurationSeconds?: number;
  shouldCancel?: () => boolean;
  abortSignal?: AbortSignal;
  getHydrologyInputsAt: (params: {
    at: Date;
    elapsedSeconds: number;
    waterLevelM: number;
    waterDebtM3: number;
    dtS: number;
  }) => {
    et0DepthRateMps: number;
    kc: number;
    stressCoefficient: number;
    drainageCoefficientPerSecond: number;
    fieldCapacityDepthM: number;
    valveOpen: boolean;
    inflowMode: "pressure_aware" | "constant_flow";
    baseFlowRateM3s: number;
    pressurePa: number;
    nominalPressurePa: number;
    maxPressureMultiplier: number;
    constantFlowM3s?: number;
  };
};

const DEFAULTS = {
  initialDtS: 10,
  minDtS: 0.5,
  maxDtS: 60,
  absTolM: 1e-4,
  relTol: 1e-5,
  maxRefinementsPerStep: 8,
  maxDryDurationSeconds: 14_400,
} as const;

export function simulateIrrigationRun(
  input: SimulateIrrigationRunInput,
): Result<PhysicsRunOutput> {
  if (input.horizonSeconds <= 0) {
    return err(
      createDomainError({
        code: "INVALID_INPUT",
        message: "horizonSeconds must be > 0.",
        retryable: false,
        context: { horizonSeconds: input.horizonSeconds },
      }),
    );
  }

  const hydrologyModel = new HydrologyModelV1();
  const engine = new IrrigationPhysicsEngine(hydrologyModel);

  const runResult = engine.run({
    startTimestamp: input.startTimestamp,
    horizonSeconds: asSeconds(input.horizonSeconds, "horizonSeconds"),
    initialState: {
      waterLevelM: asMeters(input.initialWaterLevelM, "initialWaterLevelM"),
      waterDebtM3: asCubicMeters(
        input.initialWaterDebtM3 ?? 0,
        "initialWaterDebtM3",
      ),
    },
    irrigatedAreaM2: asSquareMeters(input.areaM2, "areaM2"),
    initialDtS: asSeconds(
      input.initialDtS ?? DEFAULTS.initialDtS,
      "initialDtS",
    ),
    minDtS: asSeconds(input.minDtS ?? DEFAULTS.minDtS, "minDtS"),
    maxDtS: asSeconds(input.maxDtS ?? DEFAULTS.maxDtS, "maxDtS"),
    absTolM: input.absTolM ?? DEFAULTS.absTolM,
    relTol: input.relTol ?? DEFAULTS.relTol,
    maxRefinementsPerStep:
      input.maxRefinementsPerStep ?? DEFAULTS.maxRefinementsPerStep,
    maxDryDurationSeconds: asSeconds(
      input.maxDryDurationSeconds ?? DEFAULTS.maxDryDurationSeconds,
      "maxDryDurationSeconds",
    ),
    shouldCancel: () =>
      Boolean(input.abortSignal?.aborted) || Boolean(input.shouldCancel?.()),
    getDerivativeTerms: ({ timestamp, elapsedSeconds, state, dtS }) => {
      const runtimeInputs = input.getHydrologyInputsAt({
        at: timestamp,
        elapsedSeconds: toNumber(elapsedSeconds),
        waterLevelM: toNumber(state.waterLevelM),
        waterDebtM3: toNumber(state.waterDebtM3),
        dtS: toNumber(dtS),
      });

      return resolveDerivativeTermsFromHydrologyModel({
        model: hydrologyModel,
        input: {
          et: {
            et0DepthRateMps: runtimeInputs.et0DepthRateMps,
            kc: runtimeInputs.kc,
            stressCoefficient: asUnitInterval(
              runtimeInputs.stressCoefficient,
              "stressCoefficient",
            ),
            irrigatedAreaM2: asSquareMeters(input.areaM2, "areaM2"),
          },
          drainage: {
            drainageCoefficientPerSecond:
              runtimeInputs.drainageCoefficientPerSecond,
            fieldCapacityDepthM: asMeters(
              runtimeInputs.fieldCapacityDepthM,
              "fieldCapacityDepthM",
            ),
            waterLevelM: state.waterLevelM,
            irrigatedAreaM2: asSquareMeters(input.areaM2, "areaM2"),
            maxDrainableVolumeM3: asCubicMeters(
              Math.max(0, toNumber(state.waterLevelM) * input.areaM2),
              "maxDrainableVolumeM3",
            ),
            dtS,
          },
          inflow: {
            mode: runtimeInputs.inflowMode,
            valveOpen: runtimeInputs.valveOpen,
            baseFlowRateM3s: asCubicMetersPerSecond(
              runtimeInputs.baseFlowRateM3s,
              "baseFlowRateM3s",
            ),
            pressurePa: asPascals(runtimeInputs.pressurePa, "pressurePa"),
            nominalPressurePa: asPascals(
              runtimeInputs.nominalPressurePa,
              "nominalPressurePa",
            ),
            maxPressureMultiplier: runtimeInputs.maxPressureMultiplier,
            constantFlowM3s:
              runtimeInputs.constantFlowM3s !== undefined
                ? asCubicMetersPerSecond(
                    runtimeInputs.constantFlowM3s,
                    "constantFlowM3s",
                  )
                : undefined,
          },
        },
      });
    },
  });

  if (!runResult.ok) {
    return err(runResult.error);
  }

  return ok(runResult.value);
}
