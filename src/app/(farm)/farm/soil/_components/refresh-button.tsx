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
      className="text-navy flex cursor-pointer items-center gap-3 rounded-3xl border border-slate-200 bg-white px-7 py-4 text-sm font-semibold shadow-sm transition-all hover:bg-slate-50 active:scale-[0.97] disabled:opacity-70"
    >
      <RefreshCcw
        className={`text-teal h-4 w-4 transition-transform ${isPending ? "animate-spin" : ""}`}
      />
      <span>{isPending ? "جاري تحديث البيانات..." : "تحديث البيانات"}</span>
    </motion.button>
  );
}
