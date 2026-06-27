"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";
import { tapFeedback } from "~/lib/motion";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <motion.button
      whileTap={tapFeedback}
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className="text-navy flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold shadow-sm transition-all hover:bg-slate-50 active:scale-[0.97] disabled:opacity-70 sm:w-auto sm:gap-3 sm:rounded-3xl sm:px-7 sm:py-4 sm:text-sm"
    >
      <RefreshCcw
        className={`text-teal h-4 w-4 transition-transform ${isPending ? "animate-spin" : ""}`}
      />
      <span>{isPending ? "جاري تحديث البيانات..." : "تحديث البيانات"}</span>
    </motion.button>
  );
}
