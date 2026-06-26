"use client";

import { memo, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Droplets,
  Leaf,
  Lock,
  Sprout,
  Target,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";
import { tapFeedback } from "~/lib/motion";
import { Skeleton } from "~/app/_components/UI/Skeleton";
import {
  CROP_TARGET_MOISTURE,
  computeExpectedHarvest,
  formatDateLocal,
  type CropType,
  type GrowthStage,
} from "~/lib/crop-profile";

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
  estDurationDays: number | null;
};

export type LiveSoilSnapshot = {
  currentMoisturePct: number | null;
  wellCount: number;
  lastUpdatedAt: Date | null;
};

interface CropProfileFormProps {
  profile: CropProfile | null;
  farmId: string;
  updateAction: (
    data: FormData,
  ) => Promise<{ success: boolean; error?: string }>;
  cropTypes: CropTypeEntity[];
  growthStages: GrowthStageEntity[];
  liveSoil: LiveSoilSnapshot;
}

function CropProfileFormImpl({
  profile,
  farmId,
  updateAction,
  cropTypes,
  growthStages,
  liveSoil,
}: CropProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const initialCrop = (profile?.cropType ??
    cropTypes[0]?.type ??
    "wheat") as CropType;
  const initialStage = (profile?.growthStage ??
    growthStages[0]?.stage ??
    "vegetative") as GrowthStage;

  const [cropType, setCropType] = useState<CropType>(initialCrop);
  const [growthStage, setGrowthStage] = useState<GrowthStage>(initialStage);
  const [plantedDate, setPlantedDate] = useState<string>(
    profile?.plantedDate ? formatDateLocal(new Date(profile.plantedDate)) : "",
  );

  const targetMoisture = useMemo(
    () => CROP_TARGET_MOISTURE[cropType] ?? CROP_TARGET_MOISTURE.other,
    [cropType],
  );

  const expectedHarvestDate = useMemo(
    () => {
      const stageDurations: Partial<Record<GrowthStage, number>> = {};
      for (const s of growthStages) {
        if (s.estDurationDays != null) {
          stageDurations[s.stage as GrowthStage] = s.estDurationDays;
        }
      }
      return computeExpectedHarvest(plantedDate, growthStage, stageDurations);
    },
    [plantedDate, growthStage, growthStages],
  );

  const moistureDelta = useMemo(() => {
    if (liveSoil.currentMoisturePct === null) return null;
    return liveSoil.currentMoisturePct - targetMoisture.target;
  }, [liveSoil.currentMoisturePct, targetMoisture.target]);

  const moistureStatus = useMemo(() => {
    if (moistureDelta === null) return { label: "غير متوفر", tone: "muted" as const };
    if (moistureDelta < -10) return { label: "تحتاج ري", tone: "danger" as const };
    if (moistureDelta > 10) return { label: "رطوبة مرتفعة", tone: "warn" as const };
    return { label: "ضمن المعدل", tone: "ok" as const };
  }, [moistureDelta]);

  const handleSubmit = () => {
    setError(null);
    setSuccess(false);

    if (!plantedDate) {
      setError("يرجى إدخال تاريخ الزراعة");
      return;
    }

    const formData = new FormData();
    formData.append("farmId", farmId);
    formData.append("cropType", cropType);
    formData.append("growthStage", growthStage);
    formData.append("plantedDate", plantedDate);

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
  };

  return (
    <div className="space-y-6">
      {/* ── Editable inputs ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-50">
            <Sprout className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h3 className="text-navy text-base font-semibold">
              بيانات المحصول القابلة للتعديل
            </h3>
            <p className="text-xs text-slate-500">
              أدخل بيانات المحصول الأساسية — الباقي يُحسب تلقائياً
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Crop Type */}
          <fieldset>
            <legend className="mb-3 block text-xs font-semibold text-slate-500">
              نوع المحصول
            </legend>
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
                  }`}
                >
                  {opt.displayName}
                </motion.button>
              ))}
            </div>
          </fieldset>

          {/* Growth Stage */}
          <fieldset>
            <legend className="mb-3 block text-xs font-semibold text-slate-500">
              مرحلة النمو الحالية
            </legend>
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
                  }`}
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
          </fieldset>

          {/* Planting date */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-500">
              تاريخ الزراعة
            </label>
            <div className="relative max-w-sm">
              <Calendar className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={plantedDate}
                onChange={(e) => setPlantedDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pr-4 pl-10 text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
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
              تم حفظ بروفايل المحصول بنجاح
            </div>
          )}

          <motion.button
            whileTap={tapFeedback}
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !plantedDate}
            className="flex w-full items-center justify-center gap-2 rounded-3xl bg-teal-600 py-4 text-base font-semibold text-white transition-all hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Leaf className="h-5 w-5" />
            {isPending ? "جاري الحفظ..." : "حفظ البروفايل"}
          </motion.button>
        </div>
      </motion.div>

      {/* ── System-computed read-only cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SystemInfoCard
          icon={<Calendar className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-50"
          label="موعد الحصاد المتوقع"
          hint="يُحسب من تاريخ الزراعة + المدة المتبقية للمراحل"
          loading={false}
        >
          <div className="text-2xl font-semibold text-slate-800 tabular-nums">
            {expectedHarvestDate
              ? expectedHarvestDate.toLocaleDateString("ar-EG", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </div>
          {expectedHarvestDate && plantedDate && (
            <div className="mt-1 text-xs text-slate-500">
              بعد{" "}
              {Math.max(
                0,
                Math.round(
                  (expectedHarvestDate.getTime() - new Date(plantedDate).getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              )}{" "}
              يوماً من الزراعة
            </div>
          )}
        </SystemInfoCard>

        <SystemInfoCard
          icon={<Droplets className="h-5 w-5 text-cyan-600" />}
          iconBg="bg-cyan-50"
          label="نسبة الرطوبة الحالية للتربة"
          hint={
            liveSoil.currentMoisturePct === null
              ? "لا توجد قراءات حية من المستشعرات"
              : `من ${liveSoil.wellCount} مستشعر${
                  liveSoil.wellCount === 1 ? "" : "ات"
                } · ${liveSoil.lastUpdatedAt?.toLocaleTimeString("ar-EG", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
          }
          loading={false}
          tone={
            moistureStatus.tone === "danger"
              ? "red"
              : moistureStatus.tone === "warn"
                ? "amber"
                : moistureStatus.tone === "ok"
                  ? "teal"
                  : "slate"
          }
          statusBadge={moistureStatus.label}
        >
          <div className="text-2xl font-semibold text-slate-800 tabular-nums">
            {liveSoil.currentMoisturePct !== null
              ? `${liveSoil.currentMoisturePct.toFixed(0)}%`
              : "—"}
          </div>
        </SystemInfoCard>

        <SystemInfoCard
          icon={<Target className="h-5 w-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
          label="نسبة الرطوبة المراد الوصول إليها"
          hint={`المدى المثالي: ${targetMoisture.range[0]}–${targetMoisture.range[1]}%`}
          loading={false}
        >
          <div className="text-2xl font-semibold text-slate-800 tabular-nums">
            {targetMoisture.target}%
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.min(100, (targetMoisture.target / 100) * 100)}%`,
              }}
            />
          </div>
        </SystemInfoCard>
      </div>
    </div>
  );
}

function SystemInfoCard({
  icon,
  iconBg,
  label,
  hint,
  loading,
  tone,
  statusBadge,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  hint: string;
  loading: boolean;
  tone?: "red" | "amber" | "teal" | "slate";
  statusBadge?: string;
  children: React.ReactNode;
}) {
  const toneRing: Record<NonNullable<typeof tone>, string> = {
    red: "ring-red-100",
    amber: "ring-amber-100",
    teal: "ring-teal-100",
    slate: "ring-slate-100",
  };
  const toneText: Record<NonNullable<typeof tone>, string> = {
    red: "text-red-700",
    amber: "text-amber-700",
    teal: "text-teal-700",
    slate: "text-slate-500",
  };

  return (
    <div
      className={`relative rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 md:p-6 ${
        tone ? toneRing[tone] : "ring-transparent"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBg}`}>
            {icon}
          </div>
          <span className="text-xs font-semibold text-slate-500">{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {statusBadge && tone && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${toneText[tone]} bg-slate-50`}>
              {statusBadge}
            </span>
          )}
          <span
            className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500"
            title="هذه القيمة محسوبة تلقائياً ولا يمكن تعديلها"
          >
            <Lock className="h-2.5 w-2.5" />
            تلقائي
          </span>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-8 w-32 rounded-lg" />
      ) : (
        children
      )}

      {hint && (
        <div className="mt-3 flex items-start gap-1.5 border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
          <TrendingUp className="h-3 w-3 shrink-0 translate-y-px" />
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}

export const CropProfileForm = memo(CropProfileFormImpl);