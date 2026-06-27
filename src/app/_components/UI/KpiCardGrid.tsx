"use client";

import { type ReactNode, memo } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  CloudSun,
  Droplets,
  Minus,
  Percent,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { useCountUp } from "~/lib/use-count-up";

export function AnimatedNumber({
  value,
  duration = 800,
  decimals = 0,
}: {
  value: number;
  duration?: number;
  decimals?: number;
}) {
  const count = useCountUp(value, duration, decimals);
  return (
    <>
      {count.toLocaleString("ar-EG", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </>
  );
}

const KPI_ICONS = {
  droplets: Droplets,
  alertTriangle: AlertTriangle,
  activity: Activity,
  trendingDown: TrendingDown,
  trendingUp: TrendingUp,
  percent: Percent,
  cloudSun: CloudSun,
  checkCircle: CheckCircle,
  xCircle: XCircle,
  minus: Minus,
  chevronDown: ChevronDown,
} as const;

export type KpiIconName = keyof typeof KPI_ICONS;

export type KpiCardProps = {
  id: string;
  label: string;
  value: ReactNode;
  icon: KpiIconName;
  border?: string;
  iconBg?: string;
  iconColor?: string;
  extra?: ReactNode;
};

function KpiCardGridBase({ cards }: { cards: KpiCardProps[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-4 md:gap-6">
      {cards.map((card, i) => {
        const Icon = KPI_ICONS[card.icon];
        return (
          <motion.div
            key={card.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border-card bg-white p-4 transition-colors duration-200 hover:border-slate-300 hover:shadow-sm sm:p-5 md:p-6"
          >
            {/* Subtle top-right ambient glow */}
            <div className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full bg-linear-to-br from-slate-100/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-2.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5 sm:h-9 sm:w-9 ${
                  card.iconBg ?? "bg-blue-50"
                }`}
              >
                <Icon
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${card.iconColor ?? "text-blue-500"}`}
                  strokeWidth={2.5}
                />
              </div>
              <span className="min-w-0 wrap-break-words text-[12px] font-semibold leading-tight text-slate-500 sm:text-[13px]">
                {card.label}
              </span>
            </div>

            <div className="mt-auto text-3xl font-black leading-none tracking-[-0.02em] text-slate-800 tabular-nums sm:text-[1.75rem] md:text-[2.25rem]">
              {card.value}
            </div>

            {card.extra && (
              <div className="mt-2 text-[11px] font-semibold text-slate-500 transition-colors group-hover:text-slate-700 sm:mt-3 sm:text-xs">
                {card.extra}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

export const KpiCardGrid = memo(KpiCardGridBase);
