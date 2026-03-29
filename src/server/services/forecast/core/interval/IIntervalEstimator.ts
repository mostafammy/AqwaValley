import type { TrainedModel } from "~/server/services/forecast/core/LinearRegressionTrainer";

export type IntervalLevel = 0.8 | 0.95;

export type IntervalRequest = {
  model: TrainedModel;
  xValues: number[];
  level: IntervalLevel;
};

export type IntervalPoint = {
  x: number;
  yHat: number;
  lower: number;
  upper: number;
};

export interface IIntervalEstimator {
  readonly name: string;
  estimate(request: IntervalRequest): IntervalPoint[];
}
