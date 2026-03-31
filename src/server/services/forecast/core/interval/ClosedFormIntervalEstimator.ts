import type {
  IIntervalEstimator,
  IntervalPoint,
  IntervalRequest,
} from "~/server/services/forecast/core/interval/IIntervalEstimator";

function zForLevel(level: 0.8 | 0.95): number {
  return level === 0.95 ? 1.96 : 1.2816;
}

export class ClosedFormIntervalEstimator implements IIntervalEstimator {
  public readonly name = "closed-form";

  public estimate(request: IntervalRequest): IntervalPoint[] {
    const { model, xValues, level } = request;
    const n = model.sampleCount;

    if (n < 3) {
      return xValues.map((x) => {
        const yHat =
          model.coefficients.slope * x + model.coefficients.intercept;
        return { x, yHat, lower: yHat, upper: yHat };
      });
    }

    const xMean = model.x.reduce((acc, v) => acc + v, 0) / n;
    const sxx = model.x.reduce((acc, v) => acc + (v - xMean) ** 2, 0);

    let sse = 0;
    for (let i = 0; i < n; i++) {
      const x = model.x[i]!;
      const y = model.y[i]!;
      const yHat = model.coefficients.slope * x + model.coefficients.intercept;
      sse += (y - yHat) ** 2;
    }

    const sigma = Math.sqrt(sse / (n - 2));
    const z = zForLevel(level);

    return xValues.map((x) => {
      const yHat = model.coefficients.slope * x + model.coefficients.intercept;
      const leverage = sxx === 0 ? 0 : (x - xMean) ** 2 / sxx;
      const sePred = sigma * Math.sqrt(1 + 1 / n + leverage);
      const margin = z * sePred;

      return {
        x,
        yHat,
        lower: yHat - margin,
        upper: yHat + margin,
      };
    });
  }
}
