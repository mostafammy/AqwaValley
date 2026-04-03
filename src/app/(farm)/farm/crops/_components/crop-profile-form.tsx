"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Leaf } from "lucide-react";
import { motion } from "framer-motion";
import { tapFeedback } from "~/lib/motion";

type CropType =
  | "wheat"
  | "rice"
  | "corn"
  | "cotton"
  | "sugarcane"
  | "vegetables"
  | "fruits"
  | "other";

type GrowthStage =
  | "germination"
  | "vegetative"
  | "flowering"
  | "fruiting"
  | "maturity"
  | "harvest";

type CropProfile = {
  id: string;
  cropType: CropType;
  growthStage: GrowthStage;
  targetSoilMoisturePct: string | null;
  plantedDate: Date | null;
  expectedHarvestDate: Date | null;
};

type CropTypeEntity = {
  type: string;
  displayName: string;
};

type GrowthStageEntity = {
  stage: string;
  displayName: string;
  description: string | null;
};

interface CropProfileFormProps {
  profile: CropProfile | null;
  farmId: string;
  updateAction: (
    data: FormData,
  ) => Promise<{ success: boolean; error?: string }>;
  cropTypes: CropTypeEntity[];
  growthStages: GrowthStageEntity[];
}

export function CropProfileForm({
  profile,
  farmId,
  updateAction,
  cropTypes,
  growthStages,
}: CropProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [cropType, setCropType] = useState<CropType>(
    profile?.cropType ?? (cropTypes[0]?.type as CropType) ?? "wheat",
  );
  const [growthStage, setGrowthStage] = useState<GrowthStage>(
    profile?.growthStage ??
      (growthStages[0]?.stage as GrowthStage) ??
      "vegetative",
  );
  const [moisture, setMoisture] = useState<string>(
    profile?.targetSoilMoisturePct ?? "30",
  );
  function formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const [plantedDate, setPlantedDate] = useState<string>(
    profile?.plantedDate ? formatDateLocal(new Date(profile.plantedDate)) : "",
  );
  const [harvestDate, setHarvestDate] = useState<string>(
    profile?.expectedHarvestDate
      ? formatDateLocal(new Date(profile.expectedHarvestDate))
      : "",
  );
  function handleSubmit() {
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append("farmId", farmId);
    formData.append("cropType", cropType);
    formData.append("growthStage", growthStage);
    formData.append("targetSoilMoisture", moisture);
    formData.append("plantedDate", plantedDate || "");
    formData.append("expectedHarvestDate", harvestDate || "");

    startTransition(async () => {
      try {
        const result = await updateAction(formData);
        if (result.success) {
          setSuccess(true);
          router.refresh();
        } else {
          setError(result.error ?? "حدث خطأ ما");
        }
      } catch {
        setError("حدث خطأ ما");
      }
    });
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
      <h3 className="text-navy mb-6 text-base font-semibold">
        تعديل بروفايل المحصول
      </h3>

      <div className="space-y-8">
        {/* Crop Type */}
        <div>
          <label className="mb-3 block text-xs font-semibold text-slate-500">
            نوع المحصول
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cropTypes.map((opt) => (
              <motion.button
                whileTap={tapFeedback}
                key={opt.type}
                type="button"
                onClick={() => setCropType(opt.type as CropType)}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${
                  cropType === opt.type
                    ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                } `}
              >
                {opt.displayName}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Growth Stage */}
        <div>
          <label className="mb-3 block text-xs font-semibold text-slate-500">
            مرحلة النمو
          </label>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
            {growthStages.map((opt) => (
              <motion.button
                whileTap={tapFeedback}
                key={opt.stage}
                type="button"
                onClick={() => setGrowthStage(opt.stage as GrowthStage)}
                className={`rounded-2xl border px-4 py-3 text-right text-sm font-medium transition-all ${
                  growthStage === opt.stage
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                } `}
              >
                <div className="font-medium">{opt.displayName}</div>
                {opt.description && (
                  <div
                    className={`mt-0.5 text-xs ${growthStage === opt.stage ? "text-blue-100" : "text-slate-400"}`}
                  >
                    {opt.description}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Target Soil Moisture */}
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <label className="text-xs font-semibold text-slate-500">
              رطوبة التربة المستهدفة
            </label>
            <span className="text-lg font-semibold text-teal-600 tabular-nums">
              {moisture}%
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="80"
            value={moisture}
            onChange={(e) => setMoisture(e.target.value)}
            className="w-full accent-teal-600"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>10%</span>
            <span>80%</span>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-500">
              تاريخ الزراعة
            </label>
            <div className="relative">
              <Calendar className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={plantedDate}
                onChange={(e) => setPlantedDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 py-3 pr-4 pl-10 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-500">
              تاريخ الحصاد المتوقع
            </label>
            <div className="relative">
              <Calendar className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 py-3 pr-4 pl-10 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-700">
            تم حفظ البروفايل بنجاح
          </div>
        )}

        {/* Submit */}
        <motion.button
          whileTap={tapFeedback}
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-3xl bg-teal-600 py-4 text-base font-semibold text-white transition-all hover:bg-teal-700 disabled:opacity-60"
        >
          <Leaf className="h-5 w-5" />
          {isPending ? "جاري الحفظ..." : "حفظ البروفايل"}
        </motion.button>
      </div>
    </div>
  );
}
