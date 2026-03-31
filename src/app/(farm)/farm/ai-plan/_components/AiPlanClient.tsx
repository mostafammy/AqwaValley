"use client";

import {
  Sparkles,
  Droplets,
  History,
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
  ChevronDown,
  Play,
  Leaf,
  CloudSun,
} from "lucide-react";
import { api } from "~/trpc/react";
import { Card, CardBody, CardHeader, CardTitle } from "~/app/_components/UI/Card";
import { AiNeuralPulse } from "./AiNeuralPulse";
import { PlanHistorySection } from "./PlanHistorySection";
import { Button } from "~/app/_components/UI/Button";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AiPlanClientProps {
  farmId: string;
  farmName: string;
}

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

function ConfidenceBadge({ level }: { level: "HIGH" | "MEDIUM" | "LOW" }) {
  const cfg = {
    HIGH:   { label: "عالية",   bg: "badge-ok",   dot: "bg-teal"   },
    MEDIUM: { label: "متوسطة", bg: "badge-warn", dot: "bg-sand"   },
    LOW:    { label: "منخفضة", bg: "badge-danger", dot: "bg-danger" },
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
  const r = 46;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="relative w-32 h-32 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="9" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke="url(#pro-ring)" strokeWidth="9"
          strokeLinecap="round"
          strokeDashoffset={offset}
          strokeDasharray={circ}
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
        <defs>
          <linearGradient id="pro-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold text-navy leading-none">{value}%</span>
        <span className="text-xs font-medium tracking-widest text-slate-500 mt-1">مستوى الثقة</span>
      </div>
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

function ZoneCard({ zone, idx }: { zone: any; idx: number }) {
  const color = ZONE_COLORS[idx % ZONE_COLORS.length]!;
  const inactive = !zone.recommendedLitres || zone.recommendedLitres === 0;
  const litresCubic = (zone.recommendedLitres / 1000).toFixed(1);

  return (
    <Card className={`overflow-hidden transition-all hover:shadow-md ${inactive ? "opacity-60" : ""}`}>
      <CardBody className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${color}15` }}
            >
              <Leaf className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-widest text-slate-500">
                منطقة {zone.zoneId ?? idx + 1}
              </div>
              <div className="font-semibold text-lg text-navy leading-tight">{zone.cropType}</div>
              <div className="text-sm text-slate-500">{zone.growthStage}</div>
            </div>
          </div>
          {!inactive && <ConfidenceBadge level={zone.confidence ?? "HIGH"} />}
        </div>

        {!inactive ? (
          <>
            <div className="my-6 flex items-baseline gap-2 border-y border-slate-100 py-4">
              <span className="text-4xl font-semibold tabular-nums" style={{ color }}>{litresCubic}</span>
              <span className="text-xl font-medium text-slate-400">م³</span>
              <span className="mr-auto text-sm text-slate-400">
                ({zone.recommendedLitres?.toLocaleString("ar-EG")} ل)
              </span>
              <Droplets className="w-8 h-8 flex-shrink-0" style={{ color }} />
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
          <div className="my-8 py-6 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400 font-medium">
            لا يحتاج ري اليوم
          </div>
        )}

        {!inactive && (
          <div className="flex items-center justify-between text-sm mt-6 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-slate-500">
              <Calendar className="w-4 h-4" />
              {zone.scheduledAt ?? "—"}
            </div>
            {zone.notes && (
              <div className="text-sm text-slate-500 max-w-[48%] text-right truncate" title={zone.notes}>
                {zone.notes}
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
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
  loading 
}: { 
  plan?: any; 
  liveWeather?: any; 
  liveForecast?: any; 
  liveInputs?: any;
  loading?: boolean;
}) {
  const temp = liveWeather?.temp ?? plan?.temperatureC ?? "—";
  const et0 = liveForecast?.[0]?.et0 ?? plan?.et0 ?? "—";
  const rain = liveForecast?.[0]?.rain ?? plan?.rainfallForecastMm ?? 0;
  const hmd = liveInputs?.avgSoilMoisture ?? plan?.avgSoilMoisture ?? "—";
  const quota = liveInputs?.remainingQuotaLitres ?? plan?.remainingQuotaLitres;

  const inputs = [
    { icon: ThermometerSun, label: "الحرارة", value: temp, unit: "°م", warn: Number(temp) > 32 },
    { icon: Wind,           label: "ET₀",     value: et0, unit: "mm/يوم", warn: Number(et0) > 8 },
    { icon: FlaskConical,   label: "رطوبة التربة", value: typeof hmd === 'number' ? Math.round(hmd) : hmd, unit: "%", warn: Number(hmd ?? 100) < 50 },
    { icon: CloudRain,      label: "أمطار",   value: rain, unit: "mm", isGood: Number(rain) > 0 },
    { icon: Gauge,          label: "الحصة المتبقية", value: quota ? (quota / 1000).toFixed(1) : "—", unit: "م³", warn: (quota ?? 99999) < 10000 },
  ];

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-5 gap-4 ${loading ? "animate-pulse" : ""}`}>
      {inputs.map(({ icon: Icon, label, value, unit, warn, isGood }) => (
        <div
          key={label}
          className={`rounded-3xl px-5 py-4 flex flex-col gap-2 border text-sm transition-all ${
            warn 
              ? "bg-amber-50 border-amber-200 text-amber-700 shadow-sm" 
              : isGood 
                ? "bg-blue-50 border-blue-200 text-blue-700 shadow-sm"
                : "bg-white border-slate-100 shadow-sm hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between">
            <Icon className={`w-5 h-5 ${warn ? "text-amber-500" : isGood ? "text-blue-500" : "text-slate-400"}`} />
            {(liveWeather || liveForecast || liveInputs) && (
              <span className={`w-1.5 h-1.5 rounded-full ${isGood ? "bg-blue-400" : "bg-teal"} shadow-sm`} />
            )}
          </div>
          <div>
            <div className="font-bold text-navy text-xl tabular-nums">
              {value} <span className="text-xs font-semibold text-slate-400">{unit}</span>
            </div>
            <div className="text-[10px] font-medium text-slate-500 mt-1 uppercase tracking-wider">
              {label === "أمطار" ? (
                Number(value) > 0 ? (
                  <span className="text-blue-600 font-bold">أمطار متوقعة اليوم</span>
                ) : (
                  <span>سماء صافية</span>
                )
              ) : label}
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

function EmptyState({ onGenerate, loading }: { onGenerate: () => void; loading: boolean }) {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-16 flex flex-col items-center justify-center text-center min-h-[420px]">
      <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-8">
        <Droplets className="w-9 h-9 text-slate-400" />
      </div>
      <h3 className="text-2xl font-semibold text-navy mb-3">لا توجد خطة ري حالياً</h3>
      <p className="max-w-md text-slate-600 mb-10">
        اضغط على الزر أدناه ليحلل النظام بيانات المزرعة ويولد خطة الري الأمثل لليوم بناءً على معادلات FAO-56
      </p>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="btn btn-primary px-10 py-4 rounded-3xl flex items-center gap-3 text-base font-semibold"
      >
        <Zap className="w-5 h-5" />
        {loading ? "جاري التوليد..." : "توليد خطة الري الذكية"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function AiPlanClient({ farmId, farmName }: AiPlanClientProps) {
  const utils = api.useUtils();

  const { data: latestPlanRecord, isLoading } = api.irrigation.getLatestPlan.useQuery(
    { farmId },
    { refetchOnWindowFocus: false, staleTime: 1000 * 60 * 5 }
  );

  const { data: liveWeather, isLoading: weatherLoading } = api.weather.getCurrent.useQuery({ farmId });
  const { data: liveForecast, isLoading: forecastLoading } = api.weather.getForecast.useQuery({ farmId });
  const { data: liveInputs, isLoading: inputsLoading } = api.irrigation.getLiveInputs.useQuery({ farmId });

  const generatePlan = api.irrigation.requestPlan.useMutation({
    onSuccess: () => { 
      utils.irrigation.getLatestPlan.invalidate({ farmId });
      utils.irrigation.getLiveInputs.invalidate({ farmId });
      utils.irrigation.listPlans.invalidate({ farmId });
    },
  });

  const activatePlan = api.irrigation.activatePlan.useMutation({
    onSuccess: () => { 
      utils.irrigation.getLatestPlan.invalidate({ farmId });
      utils.irrigation.listPlans.invalidate({ farmId });
    },
  });
  const plan = latestPlanRecord?.plan as any;
  const isActivated = latestPlanRecord?.status === "ACTIVATED";
  const isDataLoading = weatherLoading || forecastLoading || inputsLoading;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Cpu className="w-10 h-10 text-slate-400 animate-spin" />
        <p className="text-slate-500 font-medium">جاري تحميل خطة الري...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10" dir="rtl">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
        <div>
          <div className="flex items-center mb-2">
            <span className="inline-flex items-center px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-600 rounded-3xl">
              ✦ الذكاء الاصطناعي
            </span>
            <span className="text-sm text-slate-500 font-medium">• {farmName}</span>
          </div>
          <h1 className="text-5xl font-semibold  tracking-tight text-navy">
            خطة الري <span className="text-teal mb-2">الذكية</span>
          </h1>
          <p className="text-slate-500 mt-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-teal rounded-full animate-pulse" />
            تعتمد على معادلات FAO-56 • خزان الحجر الرملي النوبي
          </p>
        </div>

        <div className="flex items-center gap-6">
          <Button
            onClick={() => generatePlan.mutate({ farmId })}
            disabled={generatePlan.isPending}
            className="btn btn-primary flex items-center gap-3"
          >
            <Cpu className={`w-4 h-4 ${generatePlan.isPending ? "animate-spin" : ""}`} />
            {generatePlan.isPending ? "جاري التوليد..." : "خطة جديدة"}
          </Button>
        </div>
      </div>

      {/* Body */}
      {generatePlan.isPending ? (
        <AiNeuralPulse />
      ) : !plan ? (
        <EmptyState
          onGenerate={() => generatePlan.mutate({ farmId })}
          loading={generatePlan.isPending}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

          {/* Left Column */}
          <div className="xl:col-span-5 space-y-8">
            {/* Summary Card */}
            <Card>
              <CardBody className="p-8">
                <div className="flex justify-between mb-8">
                  <div>
                    <div className="uppercase text-xs font-semibold tracking-widest text-slate-500">ملخص الخطة</div>
                    <div className="text-2xl font-semibold text-navy mt-1">إجمالي الري اليوم</div>
                  </div>
                  <ConfidenceRing value={plan.confidence ?? 94} />
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-6xl font-semibold text-navy tabular-nums">
                    {((plan.totalLitres ?? 0) / 1000).toFixed(1)}
                  </span>
                  <span className="text-3xl text-slate-300">م³</span>
                </div>
                <div className="text-slate-500 text-sm mt-1">
                  {(plan.totalLitres ?? 0).toLocaleString("ar-EG")} لتر
                </div>

                {plan.quotaWarning && (
                  <div className="mt-8 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-700 px-5 py-4 rounded-3xl text-sm font-medium">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    تم تقليص الكمية لتناسب الحصة المتبقية
                  </div>
                )}

                <div className="mt-10 flex items-center justify-between text-sm border-t pt-6">
                  <div>
                    <div className="text-xs text-slate-400">تاريخ التوليد</div>
                    <div className="font-medium text-navy">{formatDate(latestPlanRecord!.createdAt)}</div>
                  </div>

                  <div className={`px-5 py-2 rounded-3xl flex items-center gap-2 text-sm font-medium ${
                    isActivated ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {isActivated ? <CheckCircle className="w-4 h-4" /> : <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                    {isActivated ? "مُفعّلة" : "قيد المراجعة"}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* AI Reasoning */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-teal-50 rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-teal" />
                  </div>
                  <CardTitle>تحليل المهندس الزراعي</CardTitle>
                </div>
              </CardHeader>
              <CardBody className="pt-2">
                <p className="text-slate-600 leading-relaxed">“{plan.reasoning}”</p>
                {plan.nextIrrigationDate && (
                  <div className="mt-6 flex items-center gap-2 text-teal text-sm font-medium">
                    <Calendar className="w-4 h-4" />
                    الري القادم المقترح: {plan.nextIrrigationDate}
                  </div>
                )}
              </CardBody>
            </Card>

            {!isActivated && (
              <button
                onClick={() => activatePlan.mutate({ planId: latestPlanRecord!.id })}
                disabled={activatePlan.isPending}
                className="btn btn-primary w-full py-5 text-base font-semibold"
              >
                <Play className="w-5 h-5" />
                {activatePlan.isPending ? "جاري الاعتماد..." : "اعتماد وتفعيل الخطة"}
              </button>
            )}
          </div>

          {/* Right Column */}
          <div className="xl:col-span-7 space-y-8">
            <InputsStrip 
              plan={plan} 
              liveWeather={liveWeather}
              liveForecast={liveForecast}
              liveInputs={liveInputs}
              loading={isDataLoading}
            />

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-navy">توزيع الري حسب المناطق</h2>
              <div className="flex items-center gap-2 text-xs uppercase font-medium text-slate-400">
                <Cpu className="w-3.5 h-3.5" />
                {latestPlanRecord?.modelUsed ?? "claude-sonnet"}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plan.zones?.map((zone: any, i: number) => (
                <ZoneCard key={zone.zoneId ?? i} zone={zone} idx={i} />
              ))}
            </div>

            {/* Savings banner */}
            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex items-center gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-200">
                <Droplets className="w-7 h-7 text-teal" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">توفير مياه بنسبة ~15%</div>
                <div className="text-sm text-slate-600">
                  مقارنة بالري التقليدي • بناءً على معادلات FAO-56 المخصصة لمناخ الصحراء الغربية
                </div>
              </div>
              <ArrowLeft className="w-5 h-5 text-slate-400 flex-shrink-0" />
            </div>
          </div>
        </div>
      )}


        <div className="pt-8 border-t">
          <PlanHistorySection
            farmId={farmId}
            onActivate={(planId) => activatePlan.mutate({ planId })}
          />
        </div>
      
    </div>
  );
}