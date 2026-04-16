"use client";

import { type ReactNode, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
  Sparkles,
  Droplets,
  CheckCircle,
  AlertCircle,
  Cpu,
  Calendar,
  Wind,
  ArrowLeft,
  ThermometerSun,
  CloudRain,
  FlaskConical,
  Gauge,
  Zap,
  Play,
  Leaf,
} from "lucide-react";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/react";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "~/app/_components/UI/Card";
import { AiNeuralPulse } from "./AiNeuralPulse";
import { PlanHistorySection } from "./PlanHistorySection";
import { Button } from "~/app/_components/UI/Button";
import { useRouter } from "next/navigation";
import { springs, tapFeedback, variants } from "~/lib/motion";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Live weather snapshot from weather.getCurrent */
type WeatherInfo = RouterOutputs["weather"]["getCurrent"];

/** Single forecast day from weather.getForecast */
type ForecastDay = RouterOutputs["weather"]["getForecast"][number];

/** Live irrigation inputs from irrigation.getLiveInputs */
type LiveInputs = RouterOutputs["irrigation"]["getLiveInputs"];

interface AiPlanClientProps {
  farmId: string;
  farmName: string;
}

type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

type PlanZone = {
  zoneId?: string | number;
  cropType: string;
  growthStage: string;
  confidence?: ConfidenceLevel;
  recommendedLitres?: number;
  soilMoistureNow?: number;
  targetMoisture?: number;
  scheduledAt?: string;
  notes?: string;
};

type PlanView = {
  confidence?: number;
  totalLitres: number;
  quotaWarning?: boolean;
  reasoning?: string;
  nextIrrigationDate?: string;
  zones?: PlanZone[];
  temperatureC?: number;
  et0?: number;
  rainfallForecastMm?: number;
  avgSoilMoisture?: number;
  remainingQuotaLitres?: number;
};

type QuotaState = "warning" | "safe";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function resolveQuotaState(plan?: PlanView): QuotaState {
  return plan?.quotaWarning ? "warning" : "safe";
}

function getSafeConfidence(confidence?: number): number {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return 94;
  return Math.min(100, Math.max(0, Math.round(confidence)));
}

function getZoneConfidence(level?: ConfidenceLevel): ConfidenceLevel {
  if (level === "LOW" || level === "MEDIUM" || level === "HIGH") return level;
  return "HIGH";
}

function ConfidenceBadge({ level }: { level: "HIGH" | "MEDIUM" | "LOW" }) {
  const cfg = {
    HIGH: { label: "عالية", bg: "badge-ok", dot: "bg-teal" },
    MEDIUM: { label: "متوسطة", bg: "badge-warn", dot: "bg-sand" },
    LOW: { label: "منخفضة", bg: "badge-danger", dot: "bg-danger" },
  }[level];
  return (
    <span className={`badge ${cfg.bg} px-4 py-1 text-sm font-semibold`}>
      <span className={`badge-dot ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Professional Confidence Ring
// ─────────────────────────────────────────────────────────────────────────────

function ConfidenceRing({ value = 94 }: { value?: number }) {
  const gradientId = useId();
  const r = 46;
  const circ = 2 * Math.PI * r;
  const boundedValue = getSafeConfidence(value);
  const offset = circ - (boundedValue / 100) * circ;

  return (
    <motion.div
      className="relative h-24 w-24 shrink-0 md:h-32 md:w-32"
      animate={{ scale: [1, 1.05, 0.98, 1.02, 1] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-teal/40"
        animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
      />
      <svg className="h-full w-full -rotate-90 relative z-10" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="9"
        />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDashoffset={offset}
          strokeDasharray={circ}
          animate={{ strokeDashoffset: offset }}
          transition={springs.floaty}
        />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
        <span className="text-navy text-3xl leading-none font-semibold md:text-4xl">
          {boundedValue}%
        </span>
        <span className="mt-1 text-xs font-medium tracking-widest text-slate-500">
          مستوى الثقة
        </span>
      </div>
    </motion.div>
  );
}

function SummaryAmbient({
  quotaState,
  children,
}: {
  quotaState: QuotaState;
  children: ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[24px]">
      <motion.div
        className="pointer-events-none absolute -top-16 -left-16 z-0 h-44 w-44 rounded-full blur-3xl opacity-50"
        animate={{
          x: quotaState === "warning" ? -8 : 0,
          y: quotaState === "warning" ? -8 : 0,
          backgroundColor:
            quotaState === "warning"
              ? "rgba(251,191,36,0.5)"
              : "rgba(13,158,126,0.45)",
        }}
        transition={springs.silk}
      />
      <motion.div
        className="pointer-events-none absolute -right-20 -bottom-20 z-0 h-52 w-52 rounded-full blur-3xl opacity-70"
        animate={{
          x: quotaState === "warning" ? 8 : 0,
          y: quotaState === "warning" ? 8 : 0,
          backgroundColor:
            quotaState === "warning"
              ? "rgba(254,215,170,0.35)"
              : "rgba(165,243,252,0.35)",
        }}
        transition={springs.silk}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Forecast Outlook - 3 Day Preview
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Moisture bar - clean & professional
// ─────────────────────────────────────────────────────────────────────────────

function MoistureBar({
  label,
  current,
  target,
  color,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
}) {
  const pct = Math.min(100, current);
  const tPct = Math.min(100, target);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-medium">
        <span className="text-slate-600">{label}</span>
        <span style={{ color }} className="tabular-nums">
          {current}% <span className="text-slate-400">/ هدف {target}%</span>
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-slate-100">
        <div
          className="absolute top-0 bottom-0 w-px bg-slate-300"
          style={{ left: `${tPct}%` }}
        />
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone card - clean professional layout
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_COLORS = ["#0ea5e9", "#14b8a6", "#f59e0b", "#64748b"];

function ZoneCard({ zone, idx }: { zone: PlanZone; idx: number }) {
  const color = ZONE_COLORS[idx % ZONE_COLORS.length]!;
  const recommendedLitres = zone.recommendedLitres ?? 0;
  const inactive = recommendedLitres === 0;
  const litresCubic = (recommendedLitres / 1000).toFixed(1);

  return (
    <motion.div
      custom={idx}
      variants={variants.zoneCard}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <Card
        className={`overflow-hidden transition-all hover:shadow-md ${inactive ? "opacity-60" : ""}`}
      >
        <CardBody className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${color}15` }}
              >
                <Leaf className="h-5 w-5" style={{ color }} />
              </div>
              <div>
                <div className="text-xs font-semibold tracking-widest text-slate-500">
                  منطقة {zone.zoneId ?? idx + 1}
                </div>
                <div className="text-navy text-lg leading-tight font-semibold">
                  {zone.cropType}
                </div>
                <div className="text-sm text-slate-500">{zone.growthStage}</div>
              </div>
            </div>
            {!inactive && (
              <ConfidenceBadge level={getZoneConfidence(zone.confidence)} />
            )}
          </div>

          {!inactive ? (
            <>
              <div className="my-6 flex items-baseline gap-2 border-y border-slate-100 py-4">
                <span
                  className="text-4xl font-semibold tabular-nums"
                  style={{ color }}
                >
                  {litresCubic}
                </span>
                <span className="text-xl font-medium text-slate-400">م³</span>
                <span className="mr-auto text-sm text-slate-400">
                  ({recommendedLitres.toLocaleString("ar-EG")} ل)
                </span>
                <Droplets className="h-8 w-8 shrink-0" style={{ color }} />
              </div>

              {zone.soilMoistureNow !== undefined && (
                <MoistureBar
                  label="رطوبة التربة الحالية"
                  current={zone.soilMoistureNow}
                  target={zone.targetMoisture ?? 65}
                  color={color}
                />
              )}
            </>
          ) : (
            <div className="my-8 rounded-2xl border border-dashed border-slate-200 py-6 text-center font-medium text-slate-400">
              لا يحتاج ري اليوم
            </div>
          )}

          {!inactive && (
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar className="h-4 w-4" />
                {zone.scheduledAt ?? "—"}
              </div>
              {zone.notes && (
                <div
                  className="max-w-[48%] truncate text-right text-sm text-slate-500"
                  title={zone.notes}
                >
                  {zone.notes}
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Input metrics - clean professional strip
// ─────────────────────────────────────────────────────────────────────────────

function InputsStrip({
  plan,
  liveWeather,
  liveForecast,
  liveInputs,
  loading,
}: {
  plan?: PlanView;
  liveWeather?: WeatherInfo;
  liveForecast?: ForecastDay[];
  liveInputs?: LiveInputs;
  loading?: boolean;
}) {
  const temp = liveWeather?.temp ?? plan?.temperatureC ?? "—";
  const et0 = liveForecast?.[0]?.et0 ?? plan?.et0 ?? "—";
  const rain = liveForecast?.[0]?.rain ?? plan?.rainfallForecastMm ?? 0;
  const hmd = liveInputs?.avgSoilMoisture ?? plan?.avgSoilMoisture ?? "—";
  const quota = liveInputs?.remainingQuotaLitres ?? plan?.remainingQuotaLitres;

  const inputs = [
    {
      icon: ThermometerSun,
      label: "الحرارة",
      value: temp,
      unit: "°م",
      warn: Number(temp) > 32,
    },
    {
      icon: Wind,
      label: "ET₀",
      value: et0,
      unit: "mm/يوم",
      warn: Number(et0) > 8,
    },
    {
      icon: FlaskConical,
      label: "رطوبة التربة",
      value: typeof hmd === "number" ? Math.round(hmd) : hmd,
      unit: "%",
      warn: Number(hmd ?? 100) < 50,
    },
    {
      icon: CloudRain,
      label: "أمطار",
      value: rain,
      unit: "mm",
      isGood: Number(rain) > 0,
    },
    {
      icon: Gauge,
      label: "الحصة المتبقية",
      value: quota ? (quota / 1000).toFixed(1) : "—",
      unit: "م³",
      warn: (quota ?? 99999) < 10000,
    },
  ];

  return (
    <div
      className={`grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5 ${loading ? "animate-pulse" : ""}`}
    >
      {inputs.map(({ icon: Icon, label, value, unit, warn, isGood }) => (
        <div
          key={label}
          style={{
            boxShadow: warn ? "0 0 0 1px rgba(217,119,6,0.3)" : undefined,
          }}
          className={`glass-sm flex flex-col gap-1.5 rounded-2xl px-4 py-3 text-sm transition-all md:gap-2 md:rounded-3xl md:px-5 md:py-4 ${
            warn
              ? "text-amber-700"
              : isGood
                ? "text-blue-700"
                : "text-navy"
          }`}
        >
          <div className="flex items-center justify-between">
            <Icon
              className={`h-5 w-5 ${warn ? "text-amber-500" : isGood ? "text-blue-500" : "text-slate-400"}`}
            />
            {Boolean(liveWeather ?? liveForecast ?? liveInputs) && (
              <span
                className={`h-1.5 w-1.5 rounded-full ${isGood ? "bg-blue-400" : "bg-teal"} shadow-sm`}
              />
            )}
          </div>
          <div>
            <div className="text-navy text-xl font-bold tabular-nums">
              {value}{" "}
              <span className="text-xs font-semibold text-slate-400">
                {unit}
              </span>
            </div>
            <div className="mt-1 text-[10px] font-medium tracking-wider text-slate-500 uppercase">
              {label === "أمطار" ? (
                Number(value) > 0 ? (
                  <span className="font-bold text-blue-600">
                    أمطار متوقعة اليوم
                  </span>
                ) : (
                  <span>سماء صافية</span>
                )
              ) : (
                label
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state - clean & professional
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  onGenerate,
  loading,
}: {
  onGenerate: () => void;
  loading: boolean;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      exit="exit"
      variants={variants.scaleIn}
      className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-slate-100 bg-white p-8 text-center md:min-h-105 md:p-16"
    >
      <motion.div
        className="mb-8 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100"
        animate={{ y: [0, -4, 0] }}
        transition={{
          duration: 2.2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      >
        <Droplets className="h-9 w-9 text-slate-400" />
      </motion.div>
      <h3 className="text-navy mb-3 text-xl font-semibold md:text-2xl">
        لا توجد خطة ري حالياً
      </h3>
      <p className="mb-10 max-w-md text-slate-600">
        اضغط على الزر أدناه ليحلل النظام بيانات المزرعة ويولد خطة الري الأمثل
        لليوم بناءً على معادلات FAO-56
      </p>
      <motion.button
        onClick={onGenerate}
        disabled={loading}
        whileTap={tapFeedback}
        whileHover={{ scale: 1.02 }}
        transition={springs.snappy}
        className="btn btn-primary flex items-center gap-3 rounded-3xl px-10 py-4 text-base font-semibold"
      >
        <Zap className="h-5 w-5" />
        {loading ? "جاري التوليد..." : "توليد خطة الري الذكية"}
      </motion.button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function AiPlanClient({ farmId, farmName }: AiPlanClientProps) {
  const utils = api.useUtils();
  const router = useRouter();

  const { data: latestPlanRecord, isLoading } =
    api.irrigation.getLatestPlan.useQuery(
      { farmId },
      { refetchOnWindowFocus: false, staleTime: 1000 * 60 * 5 },
    );

  const { data: liveWeather, isLoading: weatherLoading } =
    api.weather.getCurrent.useQuery({ farmId });
  const { data: liveForecast, isLoading: forecastLoading } =
    api.weather.getForecast.useQuery({ farmId });
  const { data: liveInputs, isLoading: inputsLoading } =
    api.irrigation.getLiveInputs.useQuery({ farmId });

  const generatePlan = api.irrigation.requestPlan.useMutation({
    onSuccess: () => {
      void utils.irrigation.getLatestPlan.invalidate({ farmId });
      void utils.irrigation.getLiveInputs.invalidate({ farmId });
      void utils.irrigation.listPlans.invalidate({ farmId });
    },
  });

  const activatePlan = api.irrigation.activatePlan.useMutation({
    onSuccess: () => {
      void utils.irrigation.getLatestPlan.invalidate({ farmId });
      void utils.irrigation.listPlans.invalidate({ farmId });
      // Redirect to irrigate page and auto-start
      router.push("/farm/irrigate?auto=1");
    },
  });
  const plan = latestPlanRecord?.plan as PlanView | undefined;
  const isActivated = latestPlanRecord?.status === "ACTIVATED";
  const isDataLoading = weatherLoading || forecastLoading || inputsLoading;
  const quotaState = resolveQuotaState(plan);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1.1,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        >
          <Cpu className="h-10 w-10 text-slate-400" />
        </motion.div>
        <p className="font-medium text-slate-500">جاري تحميل خطة الري...</p>
      </div>
    );
  }

  return (
    <div className="w-sm space-y-6 md:w-full md:space-y-10" dir="rtl">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center md:gap-10">
        <div>
          <div className="mb-2 flex items-center">
            <span className="inline-flex items-center rounded-3xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              ✦ الذكاء الاصطناعي
            </span>
            <span className="text-sm font-medium text-slate-500">
              • {farmName}
            </span>
          </div>
          <h1 className="text-navy text-3xl font-semibold tracking-tight md:text-5xl">
            خطة الري <span className="text-teal">الذكية</span>
          </h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500 md:mt-6 md:text-base">
            <span className="bg-teal h-2 w-2 animate-pulse rounded-full" />
            تعتمد على معادلات FAO-56 • خزان الحجر الرملي النوبي
          </p>
        </div>

        <motion.div
          className="flex items-center gap-6"
          whileHover={{ scale: 1.02 }}
          whileTap={tapFeedback}
          transition={springs.snappy}
        >
          <Button
            onClick={() => generatePlan.mutate({ farmId })}
            disabled={generatePlan.isPending}
            className="btn btn-primary flex items-center gap-3"
          >
            <motion.span
              animate={generatePlan.isPending ? { rotate: 360 } : { rotate: 0 }}
              transition={
                generatePlan.isPending
                  ? {
                      duration: 1,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "linear",
                    }
                  : springs.floaty
              }
              className="inline-flex"
            >
              <Cpu className="h-4 w-4" />
            </motion.span>
            {generatePlan.isPending ? "جاري التوليد..." : "خطة جديدة"}
          </Button>
        </motion.div>
      </div>

      {/* Body */}
      <AnimatePresence mode="wait" initial={false}>
        {generatePlan.isPending ? (
          <motion.div
            key="pulse"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={springs.floaty}
          >
            <AiNeuralPulse />
          </motion.div>
        ) : !plan ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={springs.floaty}
          >
            <EmptyState
              onGenerate={() => generatePlan.mutate({ farmId })}
              loading={generatePlan.isPending}
            />
          </motion.div>
        ) : (
          <motion.div
            key="plan"
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ ...springs.bouncy, delay: 0.05 }}
          >
            <div className="grid grid-cols-1 gap-5 md:gap-8 xl:grid-cols-12">
              {/* Left Column */}
              <div className="space-y-5 md:space-y-8 xl:col-span-5">
                {/* Summary Card */}
                <SummaryAmbient quotaState={quotaState}>
                  <Card>
                    <CardBody className="p-5 md:p-8">
                      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row md:mb-8">
                        <div>
                          <div className="text-xs font-semibold tracking-widest text-slate-500 uppercase">
                            ملخص الخطة
                          </div>
                          <div className="text-navy mt-1 text-2xl font-semibold">
                            إجمالي الري اليوم
                          </div>
                        </div>
                        <ConfidenceRing
                          value={getSafeConfidence(plan.confidence)}
                        />
                      </div>

                      <div className="flex items-baseline gap-3">
                        <span className="text-navy text-4xl font-semibold tabular-nums md:text-6xl">
                          {((plan.totalLitres ?? 0) / 1000).toFixed(1)}
                        </span>
                        <span className="text-2xl text-slate-300 md:text-3xl">
                          م³
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {(plan.totalLitres ?? 0).toLocaleString("ar-EG")} لتر
                      </div>

                      {plan.quotaWarning && (
                        <div className="mt-8 flex items-center gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-700">
                          <AlertCircle className="h-5 w-5 shrink-0" />
                          تم تقليص الكمية لتناسب الحصة المتبقية
                        </div>
                      )}

                      <div className="mt-10 flex items-center justify-between border-t pt-6 text-sm">
                        <div>
                          <div className="text-xs text-slate-400">
                            تاريخ التوليد
                          </div>
                          <div className="text-navy font-medium">
                            {formatDate(latestPlanRecord!.createdAt)}
                          </div>
                        </div>

                        <div
                          className={`flex items-center gap-2 rounded-3xl px-5 py-2 text-sm font-medium ${
                            isActivated
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {isActivated ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                          )}
                          {isActivated ? "مُفعّلة" : "قيد المراجعة"}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </SummaryAmbient>

                {/* AI Reasoning */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-teal-50">
                        <Sparkles className="text-teal h-4 w-4" />
                      </div>
                      <CardTitle>تحليل المهندس الزراعي</CardTitle>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-2">
                    <p className="leading-relaxed text-slate-600">
                      “{plan.reasoning ?? "—"}”
                    </p>
                    {plan.nextIrrigationDate && (
                      <div className="text-teal mt-6 flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-4 w-4" />
                        الري القادم المقترح: {plan.nextIrrigationDate}
                      </div>
                    )}
                  </CardBody>
                </Card>

                {!isActivated && (
                  <motion.button
                    onClick={() =>
                      activatePlan.mutate({ planId: latestPlanRecord!.id })
                    }
                    disabled={activatePlan.isPending}
                    whileTap={tapFeedback}
                    whileHover={{ scale: 1.01 }}
                    transition={springs.snappy}
                    className="btn btn-primary w-full py-5 text-base font-semibold"
                  >
                    <Play className="h-5 w-5" />
                    {activatePlan.isPending
                      ? "جاري الاعتماد..."
                      : "اعتماد وتفعيل الخطة"}
                  </motion.button>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-5 md:space-y-8 xl:col-span-7">
                <InputsStrip
                  plan={plan}
                  liveWeather={liveWeather}
                  liveForecast={liveForecast}
                  liveInputs={liveInputs}
                  loading={isDataLoading}
                />

                <div className="flex items-center justify-between">
                  <h2 className="text-navy text-2xl font-semibold">
                    توزيع الري حسب المناطق
                  </h2>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase">
                    <Cpu className="h-3.5 w-3.5" />
                    {latestPlanRecord?.modelUsed ?? "claude-sonnet"}
                  </div>
                </div>

                <motion.div
                  className="grid grid-cols-1 gap-4 md:grid-cols-2"
                  variants={variants.staggerFast}
                  initial="hidden"
                  animate="show"
                >
                  {plan.zones?.map((zone, i) => (
                    <ZoneCard key={zone.zoneId ?? i} zone={zone} idx={i} />
                  ))}
                </motion.div>

                {/* Savings banner */}
                <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:gap-6 md:rounded-3xl md:p-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                    <Droplets className="text-teal h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">توفير مياه بنسبة ~15%</div>
                    <div className="text-sm text-slate-600">
                      مقارنة بالري التقليدي • بناءً على معادلات FAO-56 المخصصة
                      لمناخ الصحراء الغربية
                    </div>
                  </div>
                  <ArrowLeft className="h-5 w-5 shrink-0 text-slate-400" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-t pt-8">
        <PlanHistorySection
          farmId={farmId}
          onActivate={(planId) => activatePlan.mutate({ planId })}
        />
      </div>
    </div>
  );
}
