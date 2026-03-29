import type {
  DistrictSeries,
  ExternalReferenceObservation,
  TimeWindow,
  WellSeries,
} from "~/server/services/forecast/types";

export interface DataSourceAdapter {
  readonly sourceName: string;

  loadDistrictSeries(
    districtIds: string[],
    window: TimeWindow,
  ): Promise<DistrictSeries[]>;

  loadWellTimeseries(
    wellIds: string[],
    window: TimeWindow,
  ): Promise<WellSeries[]>;

  loadExternalReferenceSeries(
    districtIds: string[],
    window: TimeWindow,
  ): Promise<ExternalReferenceObservation[]>;
}
