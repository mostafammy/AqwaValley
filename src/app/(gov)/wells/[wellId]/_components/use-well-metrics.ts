import { useQuery } from "@tanstack/react-query";

export type MetricRow = {
  bucket: string;
  type: string;
  unit: string;
  avg_value: number;
  min_value: number;
  max_value: number;
  count: number;
};

export type ApiResponse = {
  wellId: string;
  range: number;
  bucket: number;
  rows: MetricRow[];
  comparisonRows?: MetricRow[];
};

export const RANGES = [
  { label: "يوم", key: "1d", range: "24", bucket: "30" },
  { label: "أسبوع", key: "1w", range: "168", bucket: "60" },
  { label: "شهر", key: "1m", range: "720", bucket: "360" },
  { label: "سنة", key: "1y", range: "8760", bucket: "1440" },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];
export type SensorType = "water_level" | "pressure" | "flow_rate" | "humidity" | "temperature";

async function fetchMetrics(
  wellId: string,
  range: string,
  bucket: string,
  sensorType: SensorType,
  compare: boolean
): Promise<ApiResponse> {
  const params = new URLSearchParams({
    range: `${range}h`,
    bucket: `${bucket}m`,
    format: "json",
    sensorType,
    compare: compare.toString()
  });

  const res = await fetch(`/api/wells/${wellId}/metrics?${params.toString()}`);
  
  if (!res.ok) throw new Error("Failed to fetch metrics");
  return (await res.json()) as ApiResponse;
}

export function useWellMetrics(
  wellId: string,
  activeRange: RangeKey,
  sensorType: SensorType,
  compare: boolean
) {
  const cfg = RANGES.find((r) => r.key === activeRange)!;

  return useQuery({
    queryKey: ["well-metrics", wellId, activeRange, sensorType, compare],
    queryFn: () => fetchMetrics(wellId, cfg.range, cfg.bucket, sensorType, compare),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}
