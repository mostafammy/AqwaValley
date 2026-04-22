"use client";

import { type ReactNode } from "react";
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
import { entranceFadeSlideUp, STAGGER_DELAY } from "~/lib/motion";

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
  label: string;
  value: ReactNode;
  icon: KpiIconName;
  border?: string;
  iconBg?: string;
  iconColor?: string;
  extra?: ReactNode;
};

export function KpiCardGrid({ cards }: { cards: KpiCardProps[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
      {cards.map((card, i) => {
        const Icon = KPI_ICONS[card.icon];
        return (
          <motion.div
            key={i}
            {...entranceFadeSlideUp(i * STAGGER_DELAY)}
            whileHover={{ scale: 1.01, y: -2, borderColor: "#CBD5E1" }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="group relative flex flex-col overflow-hidden rounded-[18px] border border-[#E5E5EA] bg-white p-5 transition-colors duration-200 md:p-6"
          >
            {/* Subtle top-right ambient glow */}
            <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-linear-to-br from-slate-100/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="mb-4 flex items-center gap-2.5">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-110 ${
                  card.iconBg ?? "bg-blue-50"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${card.iconColor ?? "text-blue-500"}`}
                  strokeWidth={2.5}
                />
              </div>
              <span className="text-[13px] font-semibold leading-tight text-slate-500">
                {card.label}
              </span>
            </div>
            
            <div className="mt-auto relative text-[2.25rem] font-black leading-none tracking-[-0.02em] text-slate-800 tabular-nums">
              {card.value}
            </div>
            
            {card.extra && (
              <div className="relative mt-3 text-xs font-semibold text-slate-500 transition-colors group-hover:text-slate-700">
                {card.extra}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
