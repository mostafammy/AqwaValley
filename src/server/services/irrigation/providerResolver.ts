import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { cropProfile, well } from "~/server/db/schema";
import { getWeatherForecast } from "./weather";
import { createDomainError, err, ok, type Result } from "./simulation";

const KC_BY_CROP_STAGE: Record<string, Partial<Record<string, number>>> = {
  wheat: {
    germination: 0.35,
    vegetative: 0.7,
    flowering: 1.15,
    fruiting: 1.0,
    maturity: 0.5,
    harvest: 0.4,
  },
  rice: {
    germination: 1.0,
    vegetative: 1.1,
    flowering: 1.2,
    fruiting: 1.1,
    maturity: 0.9,
    harvest: 0.8,
  },
  corn: {
    germination: 0.35,
    vegetative: 0.75,
    flowering: 1.2,
    fruiting: 1.1,
    maturity: 0.6,
    harvest: 0.5,
  },
  cotton: {
    germination: 0.35,
    vegetative: 0.75,
    flowering: 1.1,
    fruiting: 1.2,
    maturity: 0.7,
    harvest: 0.6,
  },
  sugarcane: {
    germination: 0.45,
    vegetative: 0.9,
    flowering: 1.2,
    fruiting: 1.2,
    maturity: 1.0,
    harvest: 0.8,
  },
  vegetables: {
    germination: 0.45,
    vegetative: 0.85,
    flowering: 1.05,
    fruiting: 1.1,
    maturity: 0.85,
    harvest: 0.7,
  },
  fruits: {
    germination: 0.45,
    vegetative: 0.8,
    flowering: 0.95,
    fruiting: 1.05,
    maturity: 0.9,
    harvest: 0.75,
  },
  other: {
    germination: 0.4,
    vegetative: 0.75,
    flowering: 1.0,
    fruiting: 1.0,
    maturity: 0.8,
    harvest: 0.65,
  },
};

const SOIL_BY_CROP: Record<
  string,
  { drainageCoefficientPerSecond: number; fieldCapacityDepthM: number }
> = {
  wheat: { drainageCoefficientPerSecond: 0.00045, fieldCapacityDepthM: 0.75 },
  rice: { drainageCoefficientPerSecond: 0.0002, fieldCapacityDepthM: 1.1 },
  corn: { drainageCoefficientPerSecond: 0.0005, fieldCapacityDepthM: 0.8 },
  cotton: { drainageCoefficientPerSecond: 0.00052, fieldCapacityDepthM: 0.78 },
  sugarcane: {
    drainageCoefficientPerSecond: 0.00042,
    fieldCapacityDepthM: 0.9,
  },
  vegetables: {
    drainageCoefficientPerSecond: 0.00058,
    fieldCapacityDepthM: 0.68,
  },
  fruits: { drainageCoefficientPerSecond: 0.0004, fieldCapacityDepthM: 0.85 },
  other: { drainageCoefficientPerSecond: 0.0005, fieldCapacityDepthM: 0.8 },
};

type ProviderSnapshot = {
  weather: {
    et0_value_si: number;
    source: "live_api" | "cache" | "climatology";
    freshness: "FRESH" | "STALE" | "UNAVAILABLE";
    age_minutes: number;
    provider_timestamp: string;
    provider_version: string;
  };
  crop: {
    crop_type: string;
    growth_stage: string;
    kc_value: number;
    stress_coefficient: number;
    provider_version: string;
  };
  soil: {
    soil_type: string;
    ks_value_si: number;
    field_capacity_depth_m: number;
    provider_version: string;
  };
};

export type ResolvedProviderInputs = {
  et0DepthRateMps: number;
  kc: number;
  stressCoefficient: number;
  drainageCoefficientPerSecond: number;
  fieldCapacityDepthM: number;
  providerSnapshot: ProviderSnapshot;
  adapterUnitVersion: string;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const DEFAULT_DESERT_COORDS = { lat: 25.4515, lon: 30.5464 };

export async function resolveProviderInputsForRun(params: {
  farmId: string;
  districtId: string;
  at: Date;
}): Promise<Result<ResolvedProviderInputs>> {
  const [profile] = await db
    .select({
      cropType: cropProfile.cropType,
      growthStage: cropProfile.growthStage,
      targetSoilMoisturePct: cropProfile.targetSoilMoisturePct,
      updatedAt: cropProfile.updatedAt,
    })
    .from(cropProfile)
    .where(eq(cropProfile.farmId, params.farmId))
    .limit(1);

  if (!profile) {
    return err(
      createDomainError({
        code: "MISSING_MAPPING",
        message: "No crop profile found for farm; cannot resolve Kc mapping.",
        retryable: false,
        context: { farmId: params.farmId },
      }),
    );
  }

  const kc = KC_BY_CROP_STAGE[profile.cropType]?.[profile.growthStage];
  if (!kc) {
    return err(
      createDomainError({
        code: "MISSING_MAPPING",
        message: "Missing Kc mapping for crop type and growth stage.",
        retryable: false,
        context: {
          cropType: profile.cropType,
          growthStage: profile.growthStage,
        },
      }),
    );
  }

  const soil = SOIL_BY_CROP[profile.cropType] ?? SOIL_BY_CROP.other!;

  const [districtWell] = await db
    .select({ latitude: well.latitude, longitude: well.longitude })
    .from(well)
    .where(eq(well.districtId, params.districtId))
    .limit(1);

  const lat = districtWell?.latitude
    ? Number.parseFloat(String(districtWell.latitude))
    : DEFAULT_DESERT_COORDS.lat;
  const lon = districtWell?.longitude
    ? Number.parseFloat(String(districtWell.longitude))
    : DEFAULT_DESERT_COORDS.lon;

  const weather = await getWeatherForecast(lat, lon);
  const et0MmDay = weather.daily[0]?.et0 ?? 6;
  const et0DepthRateMps = et0MmDay / 1000 / 86400;
  const targetSoilMoisturePct = Number.parseFloat(
    profile.targetSoilMoisturePct ?? "90",
  );
  const stressCoefficient = clamp01(
    Number.isFinite(targetSoilMoisturePct) ? targetSoilMoisturePct / 100 : 0.9,
  );

  const providerSnapshot: ProviderSnapshot = {
    weather: {
      et0_value_si: et0DepthRateMps,
      source: "climatology",
      freshness: "STALE",
      age_minutes: 1440,
      provider_timestamp: params.at.toISOString(),
      provider_version: "weather_stub_v1",
    },
    crop: {
      crop_type: profile.cropType,
      growth_stage: profile.growthStage,
      kc_value: kc,
      stress_coefficient: stressCoefficient,
      provider_version: "crop_profile_v1",
    },
    soil: {
      soil_type: profile.cropType,
      ks_value_si: soil.drainageCoefficientPerSecond,
      field_capacity_depth_m: soil.fieldCapacityDepthM,
      provider_version: "soil_profile_v1",
    },
  };

  return ok({
    et0DepthRateMps,
    kc,
    stressCoefficient,
    drainageCoefficientPerSecond: soil.drainageCoefficientPerSecond,
    fieldCapacityDepthM: soil.fieldCapacityDepthM,
    providerSnapshot,
    adapterUnitVersion: "si_adapter_v1",
  });
}
