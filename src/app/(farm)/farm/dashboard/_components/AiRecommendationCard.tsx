"use client";

import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

type AiRecommendationCardProps = {
  farmId?: string;
};

export function AiRecommendationCard({
  farmId: _farmId,
}: AiRecommendationCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.005 }}
      transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
      className="group relative mb-4 overflow-hidden rounded-[2rem] bg-[#0A1628] shadow-xl md:mb-8"
    >
      {/* Decorative Blob */}
      <div className="pointer-events-none absolute -top-[50%] -left-[10%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(29,111,168,0.5)_0%,transparent_70%)] mix-blend-screen" />
      <div className="pointer-events-none absolute -right-[10%] -bottom-[50%] h-[250px] w-[250px] rounded-full bg-[radial-gradient(circle,rgba(212,175,55,0.15)_0%,transparent_70%)] opacity-50 mix-blend-screen transition-opacity duration-500 group-hover:opacity-100" />

      {/* Glass overlay */}
      <div className="absolute inset-0 bg-white/5 backdrop-blur-3xl" />

      <div className="relative z-10 flex flex-col items-start justify-between gap-6 p-6 md:flex-row md:items-center md:p-8">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 shadow-inner ring-1 ring-white/20 backdrop-blur-md transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">
            <Sparkles className="h-7 w-7 text-[#D4AF37]" strokeWidth={2} />
          </div>
          <div>
            <h3 className="mb-1 text-lg font-extrabold tracking-tight text-white">
              خطة الري الذكية
            </h3>
            <p className="max-w-[400px] text-sm leading-relaxed font-medium text-blue-100/70">
              دعم قرارك الزراعي باستخدام تحليل الذكاء الاصطناعي لبيانات التربة،
              الطقس، والحصة المائية المتاحة.
            </p>
          </div>
        </div>
        <Link
          href={`/farm/ai-plan`}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] px-6 py-3.5 text-sm font-bold text-[#0A1628] shadow-[0_0_20px_rgba(212,175,55,0.3)] ring-1 ring-white/20 transition-all duration-300 hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] hover:ring-white/40 active:scale-95"
        >
          إنشاء خطة ري <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        </Link>
      </div>
    </motion.div>
  );
}
