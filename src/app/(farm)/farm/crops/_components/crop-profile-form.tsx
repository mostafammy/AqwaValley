"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Droplets, Calendar, Leaf } from "lucide-react";

type CropType =
  | "wheat" | "rice" | "corn" | "cotton"
  | "sugarcane" | "vegetables" | "fruits" | "other";

type GrowthStage =
  | "germination" | "vegetative" | "flowering"
  | "fruiting" | "maturity" | "harvest";

type CropProfile = {
  id:                    string;
  cropType:              CropType;
  growthStage:           GrowthStage;
  targetSoilMoisturePct: string | null;
  plantedDate:           Date | null;
  expectedHarvestDate:   Date | null;
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
  profile:    CropProfile | null;
  farmId:     string;
  updateAction: (data: FormData) => Promise<{ success: boolean; error?: string }>;
  cropTypes:   CropTypeEntity[];
  growthStages: GrowthStageEntity[];
}

export function CropProfileForm({
  profile,
  farmId,
  updateAction,
  cropTypes,
  growthStages,
}: CropProfileFormProps) {
  const router  = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [cropType,   setCropType]   = useState<CropType>(profile?.cropType ?? (cropTypes[0]?.type as CropType) ?? "wheat");
  const [growthStage, setGrowthStage] = useState<GrowthStage>(profile?.growthStage ?? (growthStages[0]?.stage as GrowthStage) ?? "vegetative");
  const [moisture,   setMoisture]   = useState<string>((profile?.targetSoilMoisturePct ?? "30") || "30");
  const [plantedDate, setPlantedDate] = useState<string>(
    (profile?.plantedDate
      ? new Date(profile.plantedDate).toISOString().split("T")[0]
      : "") || ""
  );
  const [harvestDate, setHarvestDate] = useState<string>(
    (profile?.expectedHarvestDate
      ? new Date(profile.expectedHarvestDate).toISOString().split("T")[0]
      : "") || ""
  );

  function handleSubmit() {
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append("farmId",              farmId);
    formData.append("cropType",            cropType);
    formData.append("growthStage",         growthStage);
    formData.append("targetSoilMoisture",  moisture);
    formData.append("plantedDate",         plantedDate || "");
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
    });  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
      <h3 className="text-base font-semibold text-navy mb-6">تعديل بروفايل المحصول</h3>

      <div className="space-y-8">

        {/* Crop Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-3">
            نوع المحصول
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {cropTypes.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => setCropType(opt.type as CropType)}
                className={`
                  px-4 py-3 rounded-2xl text-sm font-medium border transition-all
                  ${cropType === opt.type
                    ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }
                `}
              >
                {opt.displayName}
              </button>
            ))}
          </div>
        </div>

        {/* Growth Stage */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-3">
            مرحلة النمو
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {growthStages.map((opt) => (
              <button
                key={opt.stage}
                type="button"
                onClick={() => setGrowthStage(opt.stage as GrowthStage)}
                className={`
                  px-4 py-3 rounded-2xl text-sm font-medium border transition-all text-right
                  ${growthStage === opt.stage
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }
                `}
              >
                <div className="font-medium">{opt.displayName}</div>
                {opt.description && (
                  <div className={`text-xs mt-0.5 ${growthStage === opt.stage ? "text-blue-100" : "text-slate-400"}`}>
                    {opt.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Target Soil Moisture */}
        <div>
          <div className="flex justify-between items-baseline mb-3">
            <label className="text-xs font-semibold text-slate-500">
              رطوبة التربة المستهدفة
            </label>
            <span className="text-teal-600 font-semibold text-lg tabular-nums">{moisture}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="80"
            value={moisture}
            onChange={(e) => setMoisture(e.target.value)}
            className="w-full accent-teal-600"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>10%</span>
            <span>80%</span>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">
              تاريخ الزراعة
            </label>
            <div className="relative">
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={plantedDate}
                onChange={(e) => setPlantedDate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">
              تاريخ الحصاد المتوقع
            </label>
            <div className="relative">
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={harvestDate}
                onChange={(e) => setHarvestDate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl text-sm text-teal-700">
            تم حفظ البروفايل بنجاح
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full py-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-3xl text-base font-semibold transition-all flex items-center justify-center gap-2"
        >
          <Leaf className="w-5 h-5" />
          {isPending ? "جاري الحفظ..." : "حفظ البروفايل"}
        </button>

      </div>
    </div>
  );
}