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
    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
      {/* Neural Core */}
      <div className="relative mb-12 flex items-center justify-center">
        {/* liquid concentric rings */}
        <div className="absolute w-64 h-64 border-2 border-teal/20 rounded-full animate-[ping_3s_ease-in-out_infinite]" style={{ animationDelay: '0s' }} />
        <div className="absolute w-48 h-48 border-2 border-teal/40 rounded-full animate-[ping_3s_ease-in-out_infinite]" style={{ animationDelay: '0.6s' }} />
        <div className="absolute w-32 h-32 border-2 border-teal/60 rounded-full animate-[ping_3s_ease-in-out_infinite]" style={{ animationDelay: '1.2s' }} />
        
        {/* inner core glow */}
        <div className="absolute inset-0 bg-teal/20 blur-3xl rounded-full animate-pulse" />
        
        {/* center icon container */}
        <div className="relative z-10 w-24 h-24 bg-white rounded-3xl shadow-[0_0_40px_rgba(13,158,126,0.3)] border border-teal-100 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-white" />
          <ActiveIcon className="w-10 h-10 text-teal relative z-10 animate-bounce transition-all duration-500" />
        </div>
      </div>

      {/* stage indicators */}
      <div className="space-y-6 text-center max-w-sm w-full">
        <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden mb-8">
           <div 
             className="h-full bg-blue-600 transition-all duration-[4500ms] ease-linear"
             style={{ width: `${((currentStage + 1) / STAGES.length) * 100}%` }}
           />
        </div>

        <div className="relative overflow-hidden h-6">
          {STAGES.map((stage, i) => (
            <div
              key={stage.id}
              className={`absolute inset-0 flex items-center justify-center gap-2 text-sm md:text-base font-bold text-gray-800 transition-all duration-500 transform ${
                i === currentStage ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              <stage.icon className="w-4 h-4 text-blue-500" />
              {stage.label}
            </div>
          ))}
        </div>
        
        <p className="text-gray-500 text-xs md:text-sm px-6 leading-relaxed">
           يتم الآن دمج بيانات التربة والطقس عبر نموذج Groq الفائق لبناء خطة ري دقيقة تضمن أعلى جودة للمحصول مع أقل استهلاك للمياه.
        </p>
      </div>
    </div>
  );
}
