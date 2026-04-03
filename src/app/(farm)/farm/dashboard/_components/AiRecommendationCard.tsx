"use client";

import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

type AiRecommendationCardProps = {
  _farmId?: string;
};

export function AiRecommendationCard({ _farmId }: AiRecommendationCardProps) {
  return (
    <div
      className="relative mb-4 overflow-hidden rounded-xl shadow-sm md:mb-8"
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
          background:
            "radial-gradient(circle, rgba(29, 111, 168, 0.4) 0%, transparent 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />

      <div className="relative z-10 flex flex-col items-start justify-between gap-4 p-4 md:flex-row md:items-center md:p-6">
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
            <Sparkles
              className="h-6 w-6"
              style={{ color: "var(--color-sand)" }}
            />
          </div>
          <div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                margin: 0,
                marginBottom: 4,
              }}
            >
              خطة الري الذكية
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.7)",
                margin: 0,
                maxWidth: 400,
              }}
            >
              دعم قرارك الزراعي باستخدام تحليل الذكاء الاصطناعي لبيانات التربة،
              الطقس، والحصة المائية المتاحة.
            </p>
          </div>
        </div>
        <Link href={`/farm/ai-plan`} className="btn btn-gold btn-md">
          إنشاء خطة ري <ArrowLeft className="ml-1 h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
