import type { PreparedSeries } from "~/server/services/forecast/core/FeaturePipeline";

export type ModelCoefficients = {
  slope: number;
  intercept: number;
};

export type TrainedModel = {
  coefficients: ModelCoefficients;
  sampleCount: number;
  x: number[];
  y: number[];
};

export type ModelQualityMetrics = {
  rSquared: number;
  rmse: number;
  sampleCount: number;
  dataCompletenessPct: number;
  outlierRatioPct: number;
};

export interface IModelTrainer {
  train(series: PreparedSeries): TrainedModel;
}

export interface IModelQualityReporter {
  evaluateQuality(
    model: TrainedModel,
    series: PreparedSeries,
  ): ModelQualityMetrics;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export class LinearRegressionTrainer
  implements IModelTrainer, IModelQualityReporter
{
  public train(series: PreparedSeries): TrainedModel {
    const x = series.points.map((p) => p.x);
    const y = series.points.map((p) => p.y);

    if (x.length < 2) {
      return {
        coefficients: {
          slope: 0,
          intercept: y[0] ?? 0,
        },
        sampleCount: x.length,
        x,
        y,
      };
    }

    const n = x.length;
    const xMean = x.reduce((acc, v) => acc + v, 0) / n;
    const yMean = y.reduce((acc, v) => acc + v, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (x[i]! - xMean) * (y[i]! - yMean);
      denominator += (x[i]! - xMean) ** 2;
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = yMean - slope * xMean;

    return {
      coefficients: {
        slope: round4(slope),
        intercept: round4(intercept),
      },
      sampleCount: n,
      x,
      y,
    };
  }

  public evaluateQuality(
    model: TrainedModel,
    series: PreparedSeries,
  ): ModelQualityMetrics {
    if (model.sampleCount === 0) {
      return {
        rSquared: 0,
        rmse: 0,
        sampleCount: 0,
        dataCompletenessPct: series.stats.completenessPct,
        outlierRatioPct: series.stats.outlierRatioPct,
      };
    }

    const yMean =
      model.y.reduce((acc, value) => acc + value, 0) / model.sampleCount;
    let ssTot = 0;
    let ssRes = 0;

    for (let i = 0; i < model.sampleCount; i++) {
      const x = model.x[i]!;
      const y = model.y[i]!;
      const yHat = model.coefficients.slope * x + model.coefficients.intercept;
      ssTot += (y - yMean) ** 2;
      ssRes += (y - yHat) ** 2;
    }

    const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
    const rmse = Math.sqrt(ssRes / model.sampleCount);

    return {
      rSquared: round4(rSquared),
      rmse: round4(rmse),
      sampleCount: model.sampleCount,
      dataCompletenessPct: round4(series.stats.completenessPct),
      outlierRatioPct: round4(series.stats.outlierRatioPct),
    };
  }
}
