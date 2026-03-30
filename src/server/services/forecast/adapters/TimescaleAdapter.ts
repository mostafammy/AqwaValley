import type { DataSourceAdapter } from "~/server/services/forecast/adapters/DataSourceAdapter";
import type {
  DistrictSeries,
  ExternalReferenceObservation,
  TimeWindow,
  WellSeries,
} from "~/server/services/forecast/types";

export class TimescaleAdapter implements DataSourceAdapter {
  public readonly sourceName = "timescale";

  public constructor(private readonly delegate: DataSourceAdapter) {}

  public loadDistrictSeries(
    districtIds: string[],
    window: TimeWindow,
  ): Promise<DistrictSeries[]> {
    return this.delegate.loadDistrictSeries(districtIds, window);
  }

  public loadWellTimeseries(
    wellIds: string[],
    window: TimeWindow,
  ): Promise<WellSeries[]> {
    return this.delegate.loadWellTimeseries(wellIds, window);
  }

  public loadExternalReferenceSeries(
    districtIds: string[],
    window: TimeWindow,
  ): Promise<ExternalReferenceObservation[]> {
    return this.delegate.loadExternalReferenceSeries(districtIds, window);
  }
}
