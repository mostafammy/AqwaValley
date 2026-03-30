import type {
  IIntervalEstimator,
  IntervalPoint,
  IntervalRequest,
} from "~/server/services/forecast/core/interval/IIntervalEstimator";

export type IntervalSelectorState = {
  coverageOutOfBandWindows: number;
};

export class IntervalEstimatorSelector {
  public constructor(
    private readonly primary: IIntervalEstimator,
    private readonly fallback: IIntervalEstimator,
  ) {}

  public estimate(
    request: IntervalRequest,
    state: IntervalSelectorState,
  ): { estimatorName: string; points: IntervalPoint[] } {
    const useFallback = state.coverageOutOfBandWindows >= 2;
    const estimator = useFallback ? this.fallback : this.primary;
    return {
      estimatorName: estimator.name,
      points: estimator.estimate(request),
    };
  }
}
