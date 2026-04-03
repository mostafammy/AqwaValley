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
      {cards.map((card, i) => (
        <motion.div
          key={i}
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className={`group relative overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition-all hover:shadow-lg md:p-6 ${card.border ?? ""}`}
        >
          {/* Subtle top-right ambient glow */}
          <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-linear-to-br from-slate-100/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div className="relative mb-4 flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-start">
            <span className="line-clamp-2 text-sm font-bold tracking-tight text-slate-500">
              {card.label}
            </span>
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-110 ${
                card.iconBg ?? "bg-blue-50"
              }`}
            >
              {(() => {
                const Icon = KPI_ICONS[card.icon];
                return (
                  <Icon
                    className={`h-5 w-5 ${card.iconColor ?? "text-blue-500"}`}
                    strokeWidth={2.5}
                  />
                );
              })()}
            </div>
          </div>
          <div className="relative flex items-baseline gap-1 text-3xl font-extrabold tracking-tight text-slate-800 md:text-4xl">
            {card.value}
          </div>
          {card.extra && (
            <div className="relative mt-3 text-xs font-semibold text-slate-500 transition-colors group-hover:text-slate-700">
              {card.extra}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
