import type { ForecastPolicy } from "~/server/services/forecast/policy/forecastPolicy";
import type {
  IIntervalEstimator,
  IntervalPoint,
  IntervalRequest,
} from "~/server/services/forecast/core/interval/IIntervalEstimator";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(p * sorted.length)),
  );
  return sorted[index]!;
}

function fitSimpleRegression(
  x: number[],
  y: number[],
): { slope: number; intercept: number } {
  if (x.length < 2) {
    return { slope: 0, intercept: y[0] ?? 0 };
  }

  const n = x.length;
  const xMean = x.reduce((acc, v) => acc + v, 0) / n;
  const yMean = y.reduce((acc, v) => acc + v, 0) / n;
  let num = 0;
  let den = 0;

  for (let i = 0; i < n; i++) {
    num += (x[i]! - xMean) * (y[i]! - yMean);
    den += (x[i]! - xMean) ** 2;
  }

  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

export class BootstrapIntervalEstimator implements IIntervalEstimator {
  public readonly name = "bootstrap";

  public constructor(private readonly policy: ForecastPolicy) {}

  public estimate(request: IntervalRequest): IntervalPoint[] {
    const { model, xValues, level } = request;
    const n = model.sampleCount;

    if (n === 0) {
      return xValues.map((x) => ({ x, yHat: 0, lower: 0, upper: 0 }));
    }

    if (
      n > this.policy.maxBootstrapSampleSize ||
      this.policy.maxBootstrapIterations <= 0
    ) {
      return xValues.map((x) => {
        const yHat =
          model.coefficients.slope * x + model.coefficients.intercept;
        return { x, yHat, lower: yHat, upper: yHat };
      });
    }

    const iterations = this.policy.maxBootstrapIterations;
    const predictions: number[][] = xValues.map(() => []);

    for (let iter = 0; iter < iterations; iter++) {
      const bx: number[] = [];
      const by: number[] = [];

      for (let i = 0; i < n; i++) {
        const idx = Math.floor(Math.random() * n);
        bx.push(model.x[idx]!);
        by.push(model.y[idx]!);
      }

      const fit = fitSimpleRegression(bx, by);
      for (let j = 0; j < xValues.length; j++) {
        const x = xValues[j]!;
        predictions[j]!.push(fit.slope * x + fit.intercept);
      }
    }

    const alpha = 1 - level;
    const lowerP = alpha / 2;
    const upperP = 1 - alpha / 2;

    return xValues.map((x, idx) => {
      const yHat = model.coefficients.slope * x + model.coefficients.intercept;
      const sorted = [...predictions[idx]!].sort((a, b) => a - b);
      return {
        x,
        yHat,
        lower: percentile(sorted, lowerP),
        upper: percentile(sorted, upperP),
      };
    });
  }
}
