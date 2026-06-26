export type CropType =
  | "wheat"
  | "rice"
  | "corn"
  | "cotton"
  | "sugarcane"
  | "vegetables"
  | "fruits"
  | "other";

export type GrowthStage =
  | "germination"
  | "vegetative"
  | "flowering"
  | "fruiting"
  | "maturity"
  | "harvest";

export const GROWTH_STAGE_ORDER: GrowthStage[] = [
  "germination",
  "vegetative",
  "flowering",
  "fruiting",
  "maturity",
  "harvest",
];

export const FALLBACK_STAGE_DAYS = 30;

export const CROP_TARGET_MOISTURE: Record<
  CropType,
  { target: number; range: [number, number] }
> = {
  wheat:      { target: 55, range: [45, 65] },
  rice:       { target: 80, range: [70, 90] },
  corn:       { target: 60, range: [50, 70] },
  cotton:     { target: 50, range: [40, 60] },
  sugarcane:  { target: 65, range: [55, 75] },
  vegetables: { target: 70, range: [60, 80] },
  fruits:     { target: 45, range: [35, 55] },
  other:      { target: 55, range: [45, 65] },
};

const DEFAULT_STAGE_DAYS: Record<GrowthStage, number> = {
  germination: 14,
  vegetative: 45,
  flowering: 30,
  fruiting: 30,
  maturity: 25,
  harvest: 0,
};

export const parseLocalDate = (value: string | Date): Date => {
  if (value instanceof Date) return new Date(value.getTime());
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(value);
};

export const computeExpectedHarvest = (
  plantedDate: string | Date | null | undefined,
  _currentStage: GrowthStage,
  stageDurations?: Partial<Record<GrowthStage, number>>,
): Date | null => {
  if (!plantedDate) return null;
  const planted = parseLocalDate(plantedDate);
  if (Number.isNaN(planted.getTime())) return null;

  let remainingDays = 0;
  for (const stage of GROWTH_STAGE_ORDER) {
    remainingDays +=
      stageDurations?.[stage] ?? DEFAULT_STAGE_DAYS[stage] ?? FALLBACK_STAGE_DAYS;
  }

  const harvest = new Date(planted);
  harvest.setDate(harvest.getDate() + remainingDays);
  return harvest;
};

export const formatDateLocal = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};