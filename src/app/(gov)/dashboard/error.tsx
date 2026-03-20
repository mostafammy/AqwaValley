"use client";

import { useEffect } from "react";
import { Button } from "~/app/_components/UI/Button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Gov Dashboard Error]:", error);
  }, [error]);

  return (
    <div
      className="flex flex-col items-center justify-center h-[60vh] gap-4"
      dir="rtl"
    >
      <span className="text-5xl">⚠️</span>
      <h2 className="text-xl font-semibold">فشل تحميل لوحة التحكم</h2>
      <p className="text-sm text-secondary">
        حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.
      </p>      <Button
        onClick={reset}
        variant="primary"
        size="lg"
      >
        إعادة المحاولة
      </Button>
    </div>
  );
}