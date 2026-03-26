"use client";

import { useState, useEffect } from "react";
import { Sparkles, Droplets, MapPin, Activity, CheckCircle, Leaf } from "lucide-react";

// Mock Data Contract
type ZonePlan = {
  id: string;
  name: string;
  crop: string;
  stage: string;
  recommendedVolumeM3: number;
  durationMinutes: number;
  priority: "high" | "medium" | "low";
  reasoning: string;
};

type IrrigationPlanDTO = {
  farmId: string;
  createdAt: string;
  recommendedTotalVolumeM3: number;
  sustainabilityScore: number;
  generalReasoning: string;
  zones: ZonePlan[];
};

const MOCK_PLAN: IrrigationPlanDTO = {
  farmId: "farm-1",
  createdAt: new Date().toISOString(),
  recommendedTotalVolumeM3: 420.5,
  sustainabilityScore: 92,
  generalReasoning:
    "بناءً على التوقعات الجوية للأيام الثلاثة القادمة والتي تشير إلى ارتفاع طفيف في درجات الحرارة مع انعدام فرص هطول الأمطار، وحالة التربة الحالية التي تظهر انخفاضاً في مستويات الرطوبة في المنطقة الغربية، يُنصح بتطبيق خطة ري مكثفة لتلك المنطقة مع الحفاظ على مستويات ري معتدلة لباقي المحاصيل لتجنب إجهاد النبات واستهلاك الحصة المائية بشكل مفرط.",
  zones: [
    {
      id: "zone-a",
      name: "المنطقة الغربية",
      crop: "القمح",
      stage: "النمو الخضري",
      recommendedVolumeM3: 250,
      durationMinutes: 120,
      priority: "high",
      reasoning: "رطوبة التربة منخفضة بشكل ملحوظ (28%)، المحصول في مرحلة حساسة تتطلب مياه وفيرة.",
    },
    {
      id: "zone-b",
      name: "المنطقة الشرقية",
      crop: "الذرة",
      stage: "الإنبات",
      recommendedVolumeM3: 120.5,
      durationMinutes: 60,
      priority: "medium",
      reasoning: "مستويات الرطوبة جيدة، يتطلب ري خفيف للحفاظ على السطح رطباً للإنبات.",
    },
    {
      id: "zone-c",
      name: "الحقل الجنوبي",
      crop: "الطماطم",
      stage: "التزهير",
      recommendedVolumeM3: 50,
      durationMinutes: 30,
      priority: "low",
      reasoning: "مستويات الرطوبة ممتازة بفضل الري السابق، ينصح بري وقائي خفيف فقط.",
    },
  ],
};

export default function IrrigationPlanPage() {
  const [plan, setPlan] = useState<IrrigationPlanDTO | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);

  // Simulate AI Generation Delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setPlan(MOCK_PLAN);
      setIsGenerating(false);
    }, 2500); // 2.5s simulated thinking time
    
    return () => clearTimeout(timer);
  }, []);

  if (isGenerating || !plan) {
    return (
      <div className="page h-screen flex flex-col items-center justify-center -mt-10">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
          <div className="bg-white p-6 rounded-full shadow-lg relative border border-blue-100 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-blue-500 animate-pulse" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">جاري تحليل البيانات...</h2>
        <p className="text-gray-500 text-sm max-w-sm text-center leading-relaxed">
          يقوم الذكاء الاصطناعي الآن بمراجعة قراءات التربة، التوقعات الجوية، ومعدلات استهلاك الحصة المائية لبناء الخطة الأمثل لك.
        </p>
      </div>
    );
  }

  return (
    <div
      className="p-4 md:p-6 space-y-4 md:space-y-8"
      dir="rtl"
      style={{ animation: "fadeSlideUp 0.7s ease-out both" }}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
            خطة الري الذكية
          </h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">
            تمت التوصية بواسطة Claude AI بناءً على أحدث البيانات المتاحة.
          </p>
        </div>
        <button className="btn btn-primary btn-md shrink-0">
          <CheckCircle className="w-4 h-4 ml-1" />
          تطبيق الخطة تلقائياً
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Overview & KPI */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card bg-linear-to-br from-blue-900 to-navy text-white border-none shadow-lg">
            <div className="card-body">
              <div className="flex items-center justify-between mb-6">
                <span className="text-blue-200 text-sm font-medium">الإجمالي الموصى به</span>
                <div className="p-2 bg-white/10 rounded-lg">
                  <Droplets className="w-5 h-5 text-blue-300" />
                </div>
              </div>
              <div className="text-4xl font-bold mb-2">
                {plan.recommendedTotalVolumeM3} <span className="text-xl font-normal text-blue-200">م³</span>
              </div>
              <p className="text-sm text-blue-100/80 leading-relaxed mb-6">
                يكفي لتغطية كافة متطلبات الحقل مع توفير 15% من الحصة المائية مقارنة بالري التقليدي.
              </p>
              
              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-blue-200 flex items-center gap-1">
                    <Leaf className="w-4 h-4" /> مؤشر الاستدامة
                  </span>
                  <span className="font-bold text-green-400">{plan.sustainabilityScore}/100</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full" style={{ width: `${plan.sustainabilityScore}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5">
            <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-base font-bold text-gray-800">
                تحليل الذكاء الاصطناعي
              </div>
            </div>
            <div className="text-sm text-gray-600 leading-relaxed">
              {plan.generalReasoning}
            </div>
          </div>
        </div>

        {/* Right Column - Zones Breakdown */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-lg text-gray-800 mb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gray-500" />
            تفاصيل ري المناطق
          </h3>
          
          {plan.zones.map((zone) => (
            <div key={zone.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5 hover:border-blue-300 transition-colors">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  {/* Zone Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-bold text-gray-800 text-base">{zone.name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        zone.priority === "high" ? "bg-red-100 text-red-700" :
                        zone.priority === "medium" ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {zone.priority === "high" ? "أولوية قصوى" : zone.priority === "medium" ? "متوسطة" : "منخفضة"}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs font-medium text-gray-500 mb-3">
                      <span className="flex items-center gap-1"><Leaf className="w-3 h-3" /> المحصول: {zone.crop}</span>
                      <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> المرحلة: {zone.stage}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2 rounded-md">
                      {zone.reasoning}
                    </p>
                  </div>

                  {/* Zone KPI */}
                  <div className="flex flex-row md:flex-col gap-4 md:gap-2 justify-end items-end md:w-32 shrink-0 md:border-r md:border-gray-100 md:pr-4">
                    <div className="text-left w-full">
                      <div className="text-[11px] text-gray-400 mb-0.5">الكمية الموصى بها</div>
                      <div className="font-bold text-blue-600 text-lg flex items-baseline justify-end gap-1">
                        {zone.recommendedVolumeM3} <span className="text-xs font-normal">م³</span>
                      </div>
                    </div>
                    <div className="text-left w-full hidden md:block">
                      <div className="text-[11px] text-gray-400 mb-0.5">المدة الزمنية</div>
                      <div className="font-bold text-gray-700 text-sm">
                        {zone.durationMinutes} دقيقة
                      </div>
                    </div>
                  </div>

                </div>
              </div>
          ))}

        </div>
      </div>
    </div>
  );
}
