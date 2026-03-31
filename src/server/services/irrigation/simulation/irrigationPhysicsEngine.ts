import type {
  DerivativeTerms,
  IHydrologyModel,
  IIrrigationPhysicsEngine,
  PhysicsRunInput,
  PhysicsRunOutput,
} from "./contracts";
import { runAdaptiveIntegrator } from "./adaptiveIntegrator";
import { createDomainError, err, type Result } from "./result";
import { asCubicMetersPerSecond, toNumber } from "./units";

function computeDhdtMps(params: {
  terms: DerivativeTerms;
  areaM2: number;
}): number {
  const inflow = toNumber(params.terms.inflowM3s);
  const et = toNumber(params.terms.etCubicMetersPerSecond);
  const drainage = toNumber(params.terms.drainageM3s);
  return (inflow - et - drainage) / params.areaM2;
}

export class IrrigationPhysicsEngine implements IIrrigationPhysicsEngine {
  public readonly engineVersion: string;
  public readonly hydrologyModelVersion: string;

  public constructor(
    private readonly hydrologyModel: IHydrologyModel,
    engineVersion = "irrigation_engine_v1.0.0",
  ) {
    this.engineVersion = engineVersion;
    this.hydrologyModelVersion = hydrologyModel.version;
  }

  public run(input: PhysicsRunInput): Result<PhysicsRunOutput> {
    if (input.absTolM <= 0 || input.relTol <= 0) {
      return err(
        createDomainError({
          code: "INVALID_INPUT",
          message: "absTolM and relTol must both be > 0.",
          retryable: false,
          context: { absTolM: input.absTolM, relTol: input.relTol },
        }),
      );
    }

    if (input.maxRefinementsPerStep <= 0) {
      return err(
        createDomainError({
          code: "INVALID_INPUT",
          message: "maxRefinementsPerStep must be > 0.",
          retryable: false,
          context: { maxRefinementsPerStep: input.maxRefinementsPerStep },
        }),
      );
    }

    const areaM2 = toNumber(input.irrigatedAreaM2);

    return runAdaptiveIntegrator({
      ...input,
      derivativeAtState: ({ timestamp, elapsedSeconds, state, dtS }) => {
        const derivativeTerms = input.getDerivativeTerms({
          timestamp,
          elapsedSeconds,
          state,
          dtS,
        });
        if (!derivativeTerms.ok) {
          return err(derivativeTerms.error);
        }

        const canonicalTerms: DerivativeTerms = {
          inflowM3s: asCubicMetersPerSecond(
            toNumber(derivativeTerms.value.inflowM3s),
            "canonical.inflowM3s",
          ),
          etCubicMetersPerSecond: asCubicMetersPerSecond(
            toNumber(derivativeTerms.value.etCubicMetersPerSecond),
            "canonical.etcM3s",
          ),
          drainageM3s: asCubicMetersPerSecond(
            toNumber(derivativeTerms.value.drainageM3s),
            "canonical.drainageM3s",
          ),
        };

        if (
          !Number.isFinite(toNumber(canonicalTerms.inflowM3s)) ||
          !Number.isFinite(toNumber(canonicalTerms.etCubicMetersPerSecond)) ||
          !Number.isFinite(toNumber(canonicalTerms.drainageM3s))
        ) {
          return err(
            createDomainError({
              code: "INVALID_INPUT",
              message: "Derivative terms must be finite numbers.",
              retryable: false,
              context: {
                elapsedSeconds: toNumber(elapsedSeconds),
              },
            }),
          );
        }

        const dhdtMps = computeDhdtMps({ terms: canonicalTerms, areaM2 });

        if (!Number.isFinite(dhdtMps)) {
          return err(
            createDomainError({
              code: "NUMERICAL_DIVERGENCE",
              message: "Computed derivative is non-finite.",
              retryable: false,
              context: {
                elapsedSeconds: toNumber(elapsedSeconds),
                inflowM3s: toNumber(canonicalTerms.inflowM3s),
                etcM3s: toNumber(canonicalTerms.etCubicMetersPerSecond),
                drainageM3s: toNumber(canonicalTerms.drainageM3s),
              },
            }),
          );
        }

        return {
          ok: true,
          value: {
            dhdtMps,
            inflowM3s: canonicalTerms.inflowM3s,
            etM3s: canonicalTerms.etCubicMetersPerSecond,
            drainageM3s: canonicalTerms.drainageM3s,
          },
        };
      },
    });
  }
}
