"use client";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SoilGaugeProps {
  percentage: number;
  label: string;
  target?: number;
  statusText?: string;
  color?: string;
  className?: string;
}

export function SoilGauge({
  percentage,
  label,
  target,
  statusText,
  color = "#0D9E7E",
  className,
}: SoilGaugeProps) {
  const pct = Math.round(Math.min(100, Math.max(0, percentage)));

  return (
    <div 
      className={cn(
        "text-center transition-all duration-700 ease-out animate-in fade-in zoom-in-95", 
        className
      )}
    >
      <div
        className="relative mx-auto h-24 w-24 sm:h-28 sm:w-28"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${color} 0% ${pct}%, #f1f5f9 ${pct}% 100%)`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-[5.25rem] w-[5.25rem] flex-col items-center justify-center rounded-full bg-white shadow-sm sm:h-20 sm:w-20">
            <span className="text-2xl font-semibold tabular-nums sm:text-3xl" style={{ color }}>
              {pct}
            </span>
            <span className="-mt-1 text-[10px] font-medium text-slate-400 sm:text-xs">%</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1 sm:mt-6">
        <div className="text-sm font-medium leading-tight text-navy sm:text-base">
          {label}
        </div>
        {statusText && (
          <div className="text-xs font-medium sm:text-sm" style={{ color }}>
            {statusText}
          </div>
        )}
        {target !== undefined && (
          <div className="text-[11px] text-slate-400 sm:text-xs">
            الهدف: <span className="font-medium text-slate-600">{target}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
