import type { WellReading } from "~/server/services/forecast/types";

export type RawSeriesPoint = {
  timestamp: Date;
  value: number;
};

export type NormalizedSeriesPoint = {
  // Days since first valid sample.
  x: number;
  y: number;
  timestamp: Date;
};

export type PreparedSeries = {
  scopeId: string;
  points: NormalizedSeriesPoint[];
  stats: {
    droppedMissing: number;
    droppedOutlier: number;
    completenessPct: number;
    outlierRatioPct: number;
  };
};

export type DataQualityPolicy = {
  zScoreOutlierThreshold: number;
};

export class TimeAxisNormalizer {
  public normalize(points: RawSeriesPoint[]): NormalizedSeriesPoint[] {
    if (points.length === 0) return [];

    const sorted = [...points].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
    const base = sorted[0]!.timestamp.getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    return sorted.map((p) => ({
      x: (p.timestamp.getTime() - base) / dayMs,
      y: p.value,
      timestamp: p.timestamp,
    }));
  }
}

export class DataQualityFilter {
  public constructor(private readonly policy: DataQualityPolicy) {}

  public apply(points: RawSeriesPoint[]): {
    filtered: RawSeriesPoint[];
    droppedMissing: number;
    droppedOutlier: number;
    completenessPct: number;
    outlierRatioPct: number;
  } {
    const total = points.length;
    if (total === 0) {
      return {
        filtered: [],
        droppedMissing: 0,
        droppedOutlier: 0,
        completenessPct: 0,
        outlierRatioPct: 0,
      };
    }

    const present = points.filter(
      (p) => Number.isFinite(p.value) && Number.isFinite(p.timestamp.getTime()),
    );
    const droppedMissing = total - present.length;

    if (present.length < 3) {
      return {
        filtered: present,
        droppedMissing,
        droppedOutlier: 0,
        completenessPct: (present.length / total) * 100,
        outlierRatioPct: 0,
      };
    }

    const mean = present.reduce((acc, p) => acc + p.value, 0) / present.length;
    const variance =
      present.reduce((acc, p) => acc + (p.value - mean) ** 2, 0) /
      present.length;
    const stdDev = Math.sqrt(variance);

    const filtered =
      stdDev === 0
        ? present
        : present.filter((p) => {
            const z = Math.abs((p.value - mean) / stdDev);
            return z <= this.policy.zScoreOutlierThreshold;
          });

    const droppedOutlier = present.length - filtered.length;
    const validSampleCount = present.length;

    return {
      filtered,
      droppedMissing,
      droppedOutlier,
      completenessPct: (present.length / total) * 100,
      outlierRatioPct:
        validSampleCount === 0 ? 0 : (droppedOutlier / validSampleCount) * 100,
    };
  }
}

export class FeaturePipeline {
  public constructor(
    private readonly normalizer: TimeAxisNormalizer,
    private readonly qualityFilter: DataQualityFilter,
  ) {}

  public prepare(scopeId: string, readings: WellReading[]): PreparedSeries {
    const raw: RawSeriesPoint[] = readings.map((r) => ({
      timestamp: r.timestamp,
      value: r.value,
    }));

    const quality = this.qualityFilter.apply(raw);
    const points = this.normalizer.normalize(quality.filtered);

    return {
      scopeId,
      points,
      stats: {
        droppedMissing: quality.droppedMissing,
        droppedOutlier: quality.droppedOutlier,
        completenessPct: quality.completenessPct,
        outlierRatioPct: quality.outlierRatioPct,
      },
    };
  }
}
