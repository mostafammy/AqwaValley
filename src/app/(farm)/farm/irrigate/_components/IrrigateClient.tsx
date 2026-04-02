"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Droplets,
  Play,
  Square,
  Activity,
  CheckCircle,
  Gauge,
  Timer,
  Leaf,
  Zap,
  AlertCircle,
} from "lucide-react";
import { api } from "~/trpc/react";
import { useSearchParams } from "next/navigation";
import { Card, CardBody } from "~/app/_components/UI/Card";
import { Badge } from "~/app/_components/UI/Badge";
import { Button } from "~/app/_components/UI/Button";
import type { IrrigationPlan } from "~/server/services/irrigation/schemas";

interface IrrigateClientProps {
  farmId:   string;
  farmName: string;
}

const ZONE_COLORS = ["#0ea5e9", "#14b8a6", "#f59e0b", "#64748b"];

// ── useCountUp ────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 600) {
  const [value, setValue] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    const start = prev.current;
    const diff  = target - start;
    if (diff === 0) return;

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
      else prev.current = target;
    };

    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}

// ── Circular Progress ─────────────────────────────────────────────────────────
function CircularProgress({
  pct,
  color = "#0ea5e9",
  size  = 120,
}: {
  pct:   number;
  color?: string;
  size?:  number;
}) {
  const r      = 46;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const display = useCountUp(Math.round(pct));

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r={r}
          fill="none" stroke="#f1f5f9" strokeWidth="9"
        />
        <circle
          cx="50" cy="50" r={r}
          fill="none" stroke={color} strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-navy tabular-nums">
          {display}%
        </span>
        <span className="text-[10px] text-slate-400 font-medium">مكتمل</span>
      </div>
    </div>
  );
}

// ── Animated Stat Box ─────────────────────────────────────────────────────────
function AnimatedStatBox({
  icon: Icon,
  label,
  value,
  unit,
  color = "text-navy",
}: {
  icon:   React.ElementType;
  label:  string;
  value:  number;
  unit:   string;
  color?: string;
}) {
  const display = useCountUp(value, 600);

  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 flex flex-col gap-2">
      <Icon className="w-5 h-5 text-slate-400" />
      <div>
        <div className={`text-2xl font-bold tabular-nums ${color}`}>
          {display.toLocaleString("ar-EG")}
        </div>
        <div className="text-xs text-slate-400">{unit}</div>
      </div>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}

// ── Timer Stat Box ────────────────────────────────────────────────────────────
function TimerBox({ seconds }: { seconds: number }) {
  const m  = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s  = Math.floor(seconds % 60).toString().padStart(2, "0");

  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 flex flex-col gap-2">
      <Timer className="w-5 h-5 text-slate-400" />
      <div>
        <div className="text-2xl font-bold tabular-nums font-mono text-navy">
          {m}:{s}
        </div>
        <div className="text-xs text-slate-400">دقيقة:ثانية</div>
      </div>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        الوقت المنقضي
      </div>
    </div>
  );
}

// ── Zone Status Card ──────────────────────────────────────────────────────────
function ZoneStatusCard({
  zone,
  idx,
  running,
  litersPumped,
  totalLiters,
}: {
  zone:         { zoneId?: string; cropType: string; recommendedLitres: number };
  idx:          number;
  running:      boolean;
  litersPumped: number;
  totalLiters:  number;
}) {
  const color    = ZONE_COLORS[idx % ZONE_COLORS.length]!;
  const inactive = !zone.recommendedLitres || zone.recommendedLitres === 0;

  const overallPct = totalLiters > 0 ? litersPumped / totalLiters : 0;
  const zonePumped = Math.min(
    zone.recommendedLitres,
    Math.round(overallPct * zone.recommendedLitres),
  );
  const zonePct = zone.recommendedLitres > 0
    ? (zonePumped / zone.recommendedLitres) * 100
    : 0;
  const isDone = zonePct >= 100;

  const animatedPumped = useCountUp(zonePumped, 600);

  return (
    <div className={`
      rounded-2xl border p-5 flex flex-col gap-4 transition-all
      ${inactive
        ? "bg-gray-50 border-gray-100 opacity-50"
        : isDone
          ? "bg-emerald-50 border-emerald-200"
          : running
            ? "bg-white border-blue-200 shadow-md"
            : "bg-white border-slate-100 shadow-sm"
      }
    `}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <Leaf className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <div className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
              منطقة {zone.zoneId ?? idx + 1}
            </div>
            <div className="font-semibold text-navy">{zone.cropType}</div>
          </div>
        </div>

        {!inactive && (
          isDone ? (
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          ) : running ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              يعمل
            </span>
          ) : (
            <span className="text-xs text-slate-400">جاهز</span>
          )
        )}
      </div>

      {inactive ? (
        <div className="text-center py-3 text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
          لا يحتاج ري
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{animatedPumped.toLocaleString("ar-EG")} ل</span>
              <span>{zone.recommendedLitres.toLocaleString("ar-EG")} ل</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width:      `${zonePct}%`,
                  background: isDone ? "#10b981" : color,
                }}
              />
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums" style={{ color }}>
              {(zone.recommendedLitres / 1000).toFixed(1)}
            </span>
            <span className="text-sm text-slate-400">م³ مخطط</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function IrrigateClient({ farmId, farmName }: IrrigateClientProps) {
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  const { data: latestPlanRecord } = api.irrigation.getLatestPlan.useQuery(
    { farmId },
    { refetchOnWindowFocus: false, staleTime: 1000 * 60 * 5 },
  );

  const plan        = latestPlanRecord?.plan as IrrigationPlan | undefined;
  const totalLiters = plan?.totalLitres ?? 0;

  const [running,      setRunning]      = useState(false);
  const [frameCount,   setFrameCount]   = useState(0);
  const [litersPumped, setLitersPumped] = useState(0);
  const [done,         setDone]         = useState(false);

  const frameRate = 50; // milliseconds per frame
  const seconds = frameCount * (frameRate / 1000); // Calculate fresh from frame count to avoid float errors

  // Save irrigation session state to database
  const saveSession = api.irrigation.saveSession.useMutation();

  // Load irrigation session state from database - memoize the query input
  const sessionQueryInput = useMemo(
    () => ({ farmId, planId: latestPlanRecord?.id ?? null }),
    [farmId, latestPlanRecord?.id],
  );

  const { data: savedSession } = api.irrigation.getSession.useQuery(
    sessionQueryInput,
    { enabled: !!latestPlanRecord, refetchOnWindowFocus: false, staleTime: 1000 * 60 * 5 },
  );

  // Restore saved state on mount (only once via ref)
  const restoredRef = useRef(false);
  useEffect(() => {
    if (savedSession && !restoredRef.current && !running && !done) {
      // Only restore if it appears to be a fresh mount (not already animating)
      if (frameCount === 0 && litersPumped === 0) {
        setFrameCount(savedSession.frameCount);
        setLitersPumped(savedSession.litersPumped);
        setDone(savedSession.done);
        restoredRef.current = true;
      }
    }
  }, [savedSession, running, done, frameCount, litersPumped]);

  // Auto-save state to DB every 5 frames using a ref to avoid dependency issues
  const lastSaveFrameRef = useRef(0);
  useEffect(() => {
    if (frameCount % 5 === 0 && frameCount > lastSaveFrameRef.current && frameCount > 0) {
      lastSaveFrameRef.current = frameCount;
      saveSession.mutate({
        farmId,
        planId: latestPlanRecord?.id ?? null,
        frameCount,
        litersPumped,
        done,
        running,
      });
    }
  }, [frameCount, litersPumped, done, running, farmId, latestPlanRecord?.id]);

  // Pump simulation - smooth 10 minute irrigation
  useEffect(() => {
    if (!running) return;
    
    const totalDurationMs = 10 * 60 * 1000; // 10 minutes total
    const totalFrames = totalDurationMs / frameRate;
    const literPerFrame = totalLiters / totalFrames;

    const tick = setInterval(() => {
      setFrameCount((f) => {
        const nextFrame = f + 1;
        if (nextFrame * frameRate >= totalDurationMs) {
          setRunning(false);
          setDone(true);
        }
        return nextFrame;
      });
      
      setLitersPumped((prev) => {
        const next = prev + literPerFrame;
        if (next >= totalLiters) {
          return totalLiters;
        }
        return next;
      });
    }, frameRate);
    
    return () => clearInterval(tick);
  }, [running, totalLiters, frameRate]);

  // Auto-start from AI plan page (reset restoration flag so we don't restore over auto-start)
  useEffect(() => {
    if (
      searchParams.get("auto") === "1" &&
      plan && totalLiters > 0 &&
      !running && !done
    ) {
      restoredRef.current = true; // Mark as restored so we don't restore old state
      setRunning(true);
    }
  }, [plan, searchParams, running, done, totalLiters]);

  const overallPct      = totalLiters > 0 ? (litersPumped / totalLiters) * 100 : 0;
  const remainingLiters = Math.max(0, totalLiters - litersPumped);

  // ── No plan state ────────────────────────────────────────────────────────
  if (!plan) {
    return (
      <div className="space-y-6" dir="rtl">
        <div>
          <h1 className="text-3xl font-bold text-navy">تشغيل الري</h1>
          <p className="text-sm text-slate-500 mt-1">
            مراقبة مباشرة للأنابيب والصمامات في {farmName}
          </p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 p-12 flex flex-col items-center justify-center text-center min-h-[320px]">
          <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
            <Droplets className="w-9 h-9 text-slate-400" />
          </div>
          <h3 className="text-xl font-semibold text-navy mb-3">
            لا توجد خطة ري معتمدة
          </h3>
          <p className="text-slate-500 mb-8 max-w-sm">
            يجب توليد واعتماد خطة ري من صفحة الذكاء الاصطناعي أولاً
          </p>
          <a
            href="/farm/ai-plan"
            className="btn btn-primary px-8 py-3 rounded-3xl flex items-center gap-2 font-semibold"
          >
            <Zap className="w-4 h-4" />
            توليد خطة ري
          </a>
        </div>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 md:space-y-8" dir="rtl">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-600 rounded-3xl">
              <Droplets className="w-3.5 h-3.5" />
              تشغيل الري
            </span>
            <span className="text-sm text-slate-500">• {farmName}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-navy">
            {done ? "اكتمل الري" : running ? "الري جاري" : "تشغيل الري"}
          </h1>
          <p className="text-sm text-slate-500 mt-2 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              running ? "bg-blue-500 animate-pulse" :
              done    ? "bg-emerald-500" :
              "bg-slate-300"
            }`} />
            {running ? "الأنابيب تعمل" :
            done    ? "تم ضخ المياه بنجاح" :
            "جاهز للتشغيل"}
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => {
              if (totalLiters <= 0 || running) return;
              // Restore from saved session if available and not yet restored
              if (savedSession && !restoredRef.current) {
                setFrameCount(savedSession.frameCount);
                setLitersPumped(savedSession.litersPumped);
                setDone(savedSession.done);
                restoredRef.current = true;
              } else if (!savedSession) {
                // No saved session - fresh start
                setFrameCount(0);
                setLitersPumped(0);
                setDone(false);
              }
              // If savedSession exists and already restored, just continue from current state
              setRunning(true);
            }}
            disabled={running || done || totalLiters <= 0}
            className="btn btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl"
          >
            <Play className="w-4 h-4" />
            بدء الري
          </Button>
          <Button
            variant="secondary"
            onClick={() => setRunning(false)}
            disabled={!running}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl"
          >
            <Square className="w-4 h-4" />
            إيقاف
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Left — Progress + Stats */}
        <div className="xl:col-span-5 space-y-6">

          {/* Overall Progress */}
          <Card>
            <CardBody className="p-6 md:p-8">
              <div className="uppercase text-xs font-semibold tracking-widest text-slate-400 mb-6">
                التقدم الكلي
              </div>

              <div className="flex items-center gap-6 mb-8">
                <CircularProgress
                  pct={overallPct}
                  color={done ? "#10b981" : "#0ea5e9"}
                  size={120}
                />
                <div>
                  <div className="text-4xl font-bold text-navy tabular-nums">
                    {(litersPumped / 1000).toFixed(2)}
                  </div>
                  <div className="text-slate-400 text-sm">م³ مضخوخ</div>
                  <div className="text-slate-400 text-xs mt-1">
                    من أصل {(totalLiters / 1000).toFixed(1)} م³
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{litersPumped.toLocaleString("ar-EG")} لتر</span>
                  <span>{totalLiters.toLocaleString("ar-EG")} لتر</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width:      `${overallPct}%`,
                      background: done
                        ? "#10b981"
                        : "linear-gradient(90deg, #0ea5e9, #14b8a6)",
                    }}
                  />
                </div>
              </div>

              {done && (
                <div className="mt-6 flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-5 py-4 rounded-2xl text-sm font-medium">
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  تم ضخ {totalLiters.toLocaleString("ar-EG")} لتر بنجاح
                </div>
              )}

              {plan.quotaWarning && (
                <div className="mt-4 flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-700 px-5 py-4 rounded-2xl text-sm font-medium">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  تم تقليص الكمية لتناسب الحصة المتبقية
                </div>
              )}
            </CardBody>
          </Card>

          {/* Live Stats */}
          <div className="grid grid-cols-3 gap-3">
            <AnimatedStatBox
              icon={Droplets}
              label="اللتر المضخ"
              value={litersPumped}
              unit="لتر"
              color="text-blue-600"
            />
            <TimerBox seconds={seconds} />
            <AnimatedStatBox
              icon={Gauge}
              label="المتبقي"
              value={remainingLiters}
              unit="لتر"
              color={remainingLiters === 0 ? "text-emerald-600" : "text-amber-600"}
            />
          </div>

        </div>

        {/* Right — Zones */}
        <div className="xl:col-span-7 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-navy">حالة المناطق</h2>
            <Badge variant={running ? "warn" : done ? "ok" : "info"}>
              {running ? "تشغيل" : done ? "مكتمل" : "جاهز"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plan.zones?.map((zone, i) => (
              <ZoneStatusCard
                key={zone.zoneId ?? i}
                zone={zone}
                idx={i}
                running={running}
                litersPumped={litersPumped}
                totalLiters={totalLiters}
              />
            ))}
          </div>

          {/* Plan summary */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center border border-slate-200 flex-shrink-0">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-navy text-sm">
                خطة الري المعتمدة
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {plan.zones?.length ?? 0} مناطق ·{" "}
                {(totalLiters / 1000).toFixed(1)} م³ إجمالي ·{" "}
                {plan.confidence === "HIGH"   ? "ثقة عالية"   :
                plan.confidence === "MEDIUM" ? "ثقة متوسطة" :
                "ثقة منخفضة"}
              </div>
            </div>
            <a
              href="/farm/ai-plan"
              className="text-xs text-blue-600 font-semibold hover:underline shrink-0"
            >
              عرض الخطة
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}