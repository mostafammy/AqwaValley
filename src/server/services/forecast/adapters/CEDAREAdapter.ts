import type { DataSourceAdapter } from "~/server/services/forecast/adapters/DataSourceAdapter";
import type {
  DistrictSeries,
  ExternalReferenceObservation,
  TimeWindow,
  WellSeries,
} from "~/server/services/forecast/types";

export type ExternalObservationProvider = (
  districtIds: string[],
  window: TimeWindow,
) => Promise<ExternalReferenceObservation[]>;

export class CEDAREAdapter implements DataSourceAdapter {
  public readonly sourceName = "CEDARE";

  public constructor(
    private readonly provider: ExternalObservationProvider = async () => [],
  ) {}

  public async loadDistrictSeries(
    _districtIds: string[],
    _window: TimeWindow,
  ): Promise<DistrictSeries[]> {
    return [];
  }

  public async loadWellTimeseries(
    _wellIds: string[],
    _window: TimeWindow,
  ): Promise<WellSeries[]> {
    return [];
  }

  public loadExternalReferenceSeries(
    districtIds: string[],
    window: TimeWindow,
  ): Promise<ExternalReferenceObservation[]> {
    return this.provider(districtIds, window);
  }
}
