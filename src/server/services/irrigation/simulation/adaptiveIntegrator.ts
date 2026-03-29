import type {
  PhysicsRunInput,
  PhysicsRunOutput,
  PhysicsState,
} from "./contracts";
import { createDomainError, err, ok, type Result } from "./result";
import {
  asCubicMeters,
  asMeters,
  asSeconds,
  toNumber,
  type CubicMeters,
  type CubicMetersPerSecond,
  type Meters,
  type Seconds,
  type SquareMeters,
} from "./units";

type DerivativeAtStateFn = (params: {
  timestamp: Date;
  elapsedSeconds: Seconds;
  state: PhysicsState;
  dtS: Seconds;
}) => Result<{
  dhdtMps: number;
  inflowM3s: CubicMetersPerSecond;
  etM3s: CubicMetersPerSecond;
  drainageM3s: CubicMetersPerSecond;
}>;

type IntegratorInput = Omit<PhysicsRunInput, "getDerivativeTerms"> & {
  derivativeAtState: DerivativeAtStateFn;
};

type StepResult = {
  accepted: boolean;
  nextWaterLevelM: number;
  errorNorm: number;
  refinementsUsed: number;
};

function rk4Step(params: {
  currentTimeS: number;
  currentH: number;
  dtS: number;
  toDateAtElapsed: (elapsedS: number) => Date;
  baseState: PhysicsState;
  derivativeAtState: DerivativeAtStateFn;
}): Result<number> {
  const {
    currentTimeS,
    currentH,
    dtS,
    toDateAtElapsed,
    baseState,
    derivativeAtState,
  } = params;

  const k1 = derivativeAtState({
    timestamp: toDateAtElapsed(currentTimeS),
    elapsedSeconds: asSeconds(
      Math.max(currentTimeS, Number.EPSILON),
      "elapsedSeconds",
    ),
    state: { ...baseState, waterLevelM: asMeters(currentH, "waterLevelM") },
    dtS: asSeconds(dtS, "rk4.k1.dtS"),
  });
  if (!k1.ok) return err(k1.error);

  const h2 = currentH + (dtS * k1.value.dhdtMps) / 2;
  const k2 = derivativeAtState({
    timestamp: toDateAtElapsed(currentTimeS + dtS / 2),
    elapsedSeconds: asSeconds(currentTimeS + dtS / 2, "elapsedSeconds"),
    state: { ...baseState, waterLevelM: asMeters(h2, "waterLevelM") },
    dtS: asSeconds(dtS / 2, "rk4.k2.dtS"),
  });
  if (!k2.ok) return err(k2.error);

  const h3 = currentH + (dtS * k2.value.dhdtMps) / 2;
  const k3 = derivativeAtState({
    timestamp: toDateAtElapsed(currentTimeS + dtS / 2),
    elapsedSeconds: asSeconds(currentTimeS + dtS / 2, "elapsedSeconds"),
    state: { ...baseState, waterLevelM: asMeters(h3, "waterLevelM") },
    dtS: asSeconds(dtS / 2, "rk4.k3.dtS"),
  });
  if (!k3.ok) return err(k3.error);

  const h4 = currentH + dtS * k3.value.dhdtMps;
  const k4 = derivativeAtState({
    timestamp: toDateAtElapsed(currentTimeS + dtS),
    elapsedSeconds: asSeconds(currentTimeS + dtS, "elapsedSeconds"),
    state: { ...baseState, waterLevelM: asMeters(h4, "waterLevelM") },
    dtS: asSeconds(dtS, "rk4.k4.dtS"),
  });
  if (!k4.ok) return err(k4.error);

  const nextH =
    currentH +
    (dtS / 6) *
      (k1.value.dhdtMps +
        2 * k2.value.dhdtMps +
        2 * k3.value.dhdtMps +
        k4.value.dhdtMps);

  return ok(nextH);
}

function computeP95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? 0;
}

function applyConservationDebt(params: {
  candidateWaterLevelM: number;
  currentDebtM3: CubicMeters;
  areaM2: SquareMeters;
}): {
  waterLevelM: Meters;
  waterDebtM3: CubicMeters;
  debtEventOccurred: boolean;
} {
  const area = toNumber(params.areaM2);
  let debt = toNumber(params.currentDebtM3);
  let level = params.candidateWaterLevelM;
  let debtEventOccurred = false;

  if (level < 0) {
    const deficitDepthM = -level;
    debt += deficitDepthM * area;
    level = 0;
    debtEventOccurred = true;
  }

  if (debt > 0 && level > 0) {
    const aboveGroundVolumeM3 = level * area;
    const repaymentM3 = Math.min(debt, aboveGroundVolumeM3);
    debt -= repaymentM3;
    level = (aboveGroundVolumeM3 - repaymentM3) / area;
  }

  return {
    waterLevelM: asMeters(level, "waterLevelM"),
    waterDebtM3: asCubicMeters(debt, "waterDebtM3"),
    debtEventOccurred,
  };
}

function tryAdaptiveStep(params: {
  currentTimeS: number;
  currentH: number;
  dtS: number;
  input: IntegratorInput;
  state: PhysicsState;
  toDateAtElapsed: (elapsedS: number) => Date;
}): Result<StepResult> {
  const { currentTimeS, currentH, input, state, toDateAtElapsed } = params;
  let dt = params.dtS;
  let refinementsUsed = 0;

  while (refinementsUsed <= input.maxRefinementsPerStep) {
    const full = rk4Step({
      currentTimeS,
      currentH,
      dtS: dt,
      toDateAtElapsed,
      baseState: state,
      derivativeAtState: input.derivativeAtState,
    });
    if (!full.ok) return err(full.error);

    const halfA = rk4Step({
      currentTimeS,
      currentH,
      dtS: dt / 2,
      toDateAtElapsed,
      baseState: state,
      derivativeAtState: input.derivativeAtState,
    });
    if (!halfA.ok) return err(halfA.error);

    const halfState: PhysicsState = {
      ...state,
      waterLevelM: asMeters(halfA.value, "halfStepWaterLevelM"),
    };

    const halfB = rk4Step({
      currentTimeS: currentTimeS + dt / 2,
      currentH: halfA.value,
      dtS: dt / 2,
      toDateAtElapsed,
      baseState: halfState,
      derivativeAtState: input.derivativeAtState,
    });
    if (!halfB.ok) return err(halfB.error);

    const errorNorm = Math.abs(full.value - halfB.value);
    const threshold =
      input.absTolM +
      input.relTol * Math.max(Math.abs(full.value), Math.abs(halfB.value));

    if (errorNorm <= threshold) {
      return ok({
        accepted: true,
        nextWaterLevelM: halfB.value,
        errorNorm,
        refinementsUsed,
      });
    }

    dt /= 2;
    refinementsUsed += 1;

    if (dt < toNumber(input.minDtS)) {
      return ok({
        accepted: false,
        nextWaterLevelM: currentH,
        errorNorm,
        refinementsUsed,
      });
    }
  }

  return ok({
    accepted: false,
    nextWaterLevelM: currentH,
    errorNorm: Number.POSITIVE_INFINITY,
    refinementsUsed,
  });
}

export function runAdaptiveIntegrator(
  input: IntegratorInput,
): Result<PhysicsRunOutput> {
  const horizonS = toNumber(input.horizonSeconds);
  const minDtS = toNumber(input.minDtS);
  const maxDtS = toNumber(input.maxDtS);
  let dtS = Math.min(maxDtS, Math.max(minDtS, toNumber(input.initialDtS)));

  let elapsedS = 0;
  let state: PhysicsState = {
    waterLevelM: input.initialState.waterLevelM,
    waterDebtM3: input.initialState.waterDebtM3,
  };
  let retryCount = 0;
  let integrationStepCount = 0;
  let numericalDivergenceCount = 0;
  let debtEventCount = 0;
  let dryDurationS = 0;
  let errorNormMax = 0;

  const dtValues: number[] = [];
  const errorValues: number[] = [];
  const samples: PhysicsRunOutput["samples"] = [];
  let massDebtPeakM3 = toNumber(state.waterDebtM3);

  const toDateAtElapsed = (seconds: number): Date =>
    new Date(input.startTimestamp.getTime() + seconds * 1000);

  while (elapsedS < horizonS) {
    if (input.shouldCancel?.()) {
      return ok({
        status: "cancelled",
        terminalState: state,
        samples,
        integrationStepCount,
        retryCount,
        dtMinObservedS: asSeconds(
          dtValues.length > 0 ? Math.min(...dtValues) : dtS,
          "dtMinObservedS",
        ),
        dtMaxObservedS: asSeconds(
          dtValues.length > 0 ? Math.max(...dtValues) : dtS,
          "dtMaxObservedS",
        ),
        errorNormMax,
        errorNormP95: computeP95(errorValues),
        numericalDivergenceCount,
        massDebtPeakM3: asCubicMeters(massDebtPeakM3, "massDebtPeakM3"),
        debtEventCount,
      });
    }

    const remaining = horizonS - elapsedS;
    const dtForStep = Math.min(dtS, remaining);

    const step = tryAdaptiveStep({
      currentTimeS: elapsedS,
      currentH: toNumber(state.waterLevelM),
      dtS: dtForStep,
      input,
      state,
      toDateAtElapsed,
    });

    if (!step.ok) {
      return err(step.error);
    }

    retryCount += step.value.refinementsUsed;

    if (!step.value.accepted) {
      numericalDivergenceCount += 1;
      return err(
        createDomainError({
          code: "NUMERICAL_DIVERGENCE",
          message:
            "Adaptive integrator exceeded refinement budget or dropped below minimum dt.",
          retryable: false,
          context: {
            elapsedSeconds: elapsedS,
            dtAttempted: dtForStep,
            minDtS,
            maxRefinementsPerStep: input.maxRefinementsPerStep,
          },
        }),
      );
    }

    const conserved = applyConservationDebt({
      candidateWaterLevelM: step.value.nextWaterLevelM,
      currentDebtM3: state.waterDebtM3,
      areaM2: input.irrigatedAreaM2,
    });

    state = {
      waterLevelM: conserved.waterLevelM,
      waterDebtM3: conserved.waterDebtM3,
    };

    if (conserved.debtEventOccurred) {
      debtEventCount += 1;
    }

    if (toNumber(state.waterDebtM3) > massDebtPeakM3) {
      massDebtPeakM3 = toNumber(state.waterDebtM3);
    }

    if (toNumber(state.waterLevelM) === 0 && toNumber(state.waterDebtM3) > 0) {
      dryDurationS += dtForStep;
      if (dryDurationS > toNumber(input.maxDryDurationSeconds)) {
        return err(
          createDomainError({
            code: "AQUIFER_DEPLETION",
            message:
              "Water debt persisted beyond configured dry-duration threshold.",
            retryable: false,
            context: {
              dryDurationS,
              maxDryDurationSeconds: toNumber(input.maxDryDurationSeconds),
            },
          }),
        );
      }
    } else {
      dryDurationS = 0;
    }

    elapsedS += dtForStep;
    integrationStepCount += 1;
    errorNormMax = Math.max(errorNormMax, step.value.errorNorm);
    errorValues.push(step.value.errorNorm);
    dtValues.push(dtForStep);

    samples.push({
      timestamp: toDateAtElapsed(elapsedS),
      elapsedSeconds: asSeconds(
        Math.max(elapsedS, Number.EPSILON),
        "elapsedSeconds",
      ),
      waterLevelM: state.waterLevelM,
      waterDebtM3: state.waterDebtM3,
      dtUsedS: asSeconds(dtForStep, "dtUsedS"),
      errorNorm: step.value.errorNorm,
    });

    // Conservative adaptive growth after accepted steps.
    dtS = Math.min(maxDtS, Math.max(minDtS, dtForStep * 1.25));
  }

  return ok({
    status: "completed",
    terminalState: state,
    samples,
    integrationStepCount,
    retryCount,
    dtMinObservedS: asSeconds(
      dtValues.length > 0 ? Math.min(...dtValues) : dtS,
      "dtMinObservedS",
    ),
    dtMaxObservedS: asSeconds(
      dtValues.length > 0 ? Math.max(...dtValues) : dtS,
      "dtMaxObservedS",
    ),
    errorNormMax,
    errorNormP95: computeP95(errorValues),
    numericalDivergenceCount,
    massDebtPeakM3: asCubicMeters(massDebtPeakM3, "massDebtPeakM3"),
    debtEventCount,
  });
}
