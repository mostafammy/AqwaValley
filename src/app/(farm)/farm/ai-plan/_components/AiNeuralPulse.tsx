"use client";

import { useState, useEffect } from "react";
import { Sparkles, Cpu, Search, Database, Globe } from "lucide-react";

const STAGES = [
  { id: 1, label: "جمع بيانات الحقل الحالية...", icon: Database },
  { id: 2, label: "تحليل رطوبة التربة...", icon: Search },
  { id: 3, label: "مراجعة التوقعات الجوية...", icon: Globe },
  { id: 4, label: "تطبيق قواعد الأمان FAO-56...", icon: Cpu },
  { id: 5, label: "تحسين الحصة المائية عبر الذكاء الاصطناعي...", icon: Sparkles },
];

export function AiNeuralPulse() {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStage((prev) => (prev + 1) % STAGES.length);
    }, 4500); // 4.5s per stage - simulates real "thinking" effort

    return () => clearInterval(interval);
  }, []);

  const ActiveIcon = STAGES[currentStage]?.icon ?? Sparkles;

  return (
    <div className="flex flex-col items-center justify-center px-3 py-12 animate-in fade-in duration-700 sm:py-16 md:py-20">
      {/* Neural Core */}
      <div className="relative mb-10 flex items-center justify-center sm:mb-12">
        {/* liquid concentric rings */}
        <div className="absolute h-44 w-44 border-2 border-teal/20 rounded-full animate-[ping_3s_ease-in-out_infinite] sm:h-64 sm:w-64" style={{ animationDelay: '0s' }} />
        <div className="absolute h-32 w-32 border-2 border-teal/40 rounded-full animate-[ping_3s_ease-in-out_infinite] sm:h-48 sm:w-48" style={{ animationDelay: '0.6s' }} />
        <div className="absolute h-20 w-20 border-2 border-teal/60 rounded-full animate-[ping_3s_ease-in-out_infinite] sm:h-32 sm:w-32" style={{ animationDelay: '1.2s' }} />

        {/* inner core glow */}
        <div className="absolute inset-0 bg-teal/20 blur-3xl rounded-full animate-pulse" />

        {/* center icon container */}
        <div className="relative z-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-teal-100 bg-white shadow-[0_0_40px_rgba(13,158,126,0.3)] sm:h-24 sm:w-24">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-white" />
          <ActiveIcon className="relative z-10 h-9 w-9 animate-bounce text-teal transition-all duration-500 sm:h-10 sm:w-10" />
        </div>
      </div>

      {/* stage indicators */}
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-gray-100 sm:mb-8">
           <div
             className="h-full bg-blue-600 transition-all duration-[4500ms] ease-linear"
             style={{ width: `${((currentStage + 1) / STAGES.length) * 100}%` }}
           />
        </div>

        <div className="relative h-6 overflow-hidden">
          {STAGES.map((stage, i) => (
            <div
              key={stage.id}
              className={`absolute inset-0 flex items-center justify-center gap-2 text-xs font-bold text-gray-800 transition-all duration-500 transform sm:text-sm md:text-base ${
                i === currentStage ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              <stage.icon className="h-4 w-4 shrink-0 text-blue-500" />
              <span className="px-1">{stage.label}</span>
            </div>
          ))}
        </div>

        <p className="px-2 text-xs leading-relaxed text-gray-500 sm:px-6 sm:text-sm md:text-sm">
           يتم الآن دمج بيانات التربة والطقس عبر نموذج Groq الفائق لبناء خطة ري دقيقة تضمن أعلى جودة للمحصول مع أقل استهلاك للمياه.
        </p>
      </div>
    </div>
  );
}
