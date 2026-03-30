import type { DataSourceAdapter } from "~/server/services/forecast/adapters/DataSourceAdapter";
import type {
  ForecastInputBundle,
  TimeWindow,
  WellSeries,
} from "~/server/services/forecast/types";

export class HistoricalDataLoader {
  public constructor(
    private readonly internalAdapter: DataSourceAdapter,
    private readonly externalAdapters: readonly DataSourceAdapter[] = [],
  ) {}

  public async loadDistrictBundle(args: {
    districtIds: string[];
    wellIds: string[];
    window: TimeWindow;
  }): Promise<ForecastInputBundle> {
    const [districts, wellSeries, externalReferenceChunks] = await Promise.all([
      this.internalAdapter.loadDistrictSeries(args.districtIds, args.window),
      this.internalAdapter.loadWellTimeseries(args.wellIds, args.window),
      Promise.all(
        this.externalAdapters.map((adapter) =>
          adapter.loadExternalReferenceSeries(args.districtIds, args.window),
        ),
      ),
    ]);

    return {
      districts,
      wellSeries,
      externalReferences: externalReferenceChunks.flat(),
    };
  }

  public async loadWellSeries(args: {
    wellIds: string[];
    window: TimeWindow;
  }): Promise<WellSeries[]> {
    return this.internalAdapter.loadWellTimeseries(args.wellIds, args.window);
  }
}
