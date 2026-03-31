import type {
  DerivativeTerms,
  HydrologyStepInput,
  IHydrologyModel,
} from "./contracts";
import { err, ok, type Result } from "./result";

export function resolveDerivativeTermsFromHydrologyModel(params: {
  model: IHydrologyModel;
  input: HydrologyStepInput;
}): Result<DerivativeTerms> {
  const et = params.model.computeETc(params.input.et);
  if (!et.ok) {
    return err(et.error);
  }

  const drainage = params.model.computeDrainage(params.input.drainage);
  if (!drainage.ok) {
    return err(drainage.error);
  }

  const inflow = params.model.computeInflow(params.input.inflow);
  if (!inflow.ok) {
    return err(inflow.error);
  }

  return ok({
    inflowM3s: inflow.value,
    etCubicMetersPerSecond: et.value,
    drainageM3s: drainage.value,
  });
}
