"use client";

import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

type AiRecommendationCardProps = {
  farmId: string;
};

export function AiRecommendationCard({ farmId }: AiRecommendationCardProps) {
  return (
    <div
      className="rounded-xl shadow-sm mb-4 md:mb-8 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0A1628 0%, #122240 100%)",
        color: "white",
      }}
    >
      {/* Decorative Blob */}
      <div
        style={{
          position: "absolute",
          top: "-50%",
          left: "-10%",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(29, 111, 168, 0.4) 0%, transparent 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />
      
      <div className="p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between relative z-10 gap-4">
        <div className="flex items-center gap-4">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles className="w-6 h-6" style={{ color: "var(--color-sand)" }} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 4 }}>
              خطة الري الذكية
            </h3>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0, maxWidth: 400 }}>
              دعم قرارك الزراعي باستخدام تحليل الذكاء الاصطناعي لبيانات التربة، الطقس، والحصة المائية المتاحة.
            </p>
          </div>
        </div>
        <Link href={`/farm/${farmId}/ai-plan`} className="btn btn-gold btn-md">
          إنشاء خطة ري <ArrowLeft className="w-4 h-4 ml-1" />
        </Link>
      </div>
    </div>
  );
}
