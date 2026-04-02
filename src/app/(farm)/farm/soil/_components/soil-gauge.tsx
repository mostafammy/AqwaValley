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
        className="relative w-28 h-28 mx-auto"
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
          <div className="w-20 h-20 bg-white rounded-full shadow-sm flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tabular-nums" style={{ color }}>
              {pct}
            </span>
            <span className="text-xs text-slate-400 font-medium -mt-1">%</span>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-1">
        <div className="text-base font-medium text-navy">{label}</div>
        {statusText && (
          <div className="text-sm font-medium" style={{ color }}>
            {statusText}
          </div>
        )}
        {target !== undefined && (
          <div className="text-xs text-slate-400">
            الهدف: <span className="font-medium text-slate-600">{target}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
