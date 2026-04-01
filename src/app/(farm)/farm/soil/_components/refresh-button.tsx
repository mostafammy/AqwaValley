"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className="flex items-center gap-3 px-7 py-4 bg-white border border-slate-200 rounded-3xl text-sm font-semibold text-navy hover:bg-slate-50 active:scale-[0.97] transition-all disabled:opacity-70 shadow-sm cursor-pointer"
    >
      <RefreshCcw 
        className={`w-4 h-4 text-teal transition-transform ${isPending ? "animate-spin" : ""}`} 
      />
      <span>
        {isPending ? "جاري تحديث البيانات..." : "تحديث البيانات"}
      </span>
    </button>
  );
}