"use client";

import { useEffect, useId, useState } from "react";

type WaterDropGaugeProps = {
  levelPct: number;
  size?:    number;
};

export function WaterDropGauge({ levelPct, size = 160 }: WaterDropGaugeProps) {
  const uid     = useId();
  const clipId  = `drop-clip-${uid}`;
  const gradId  = `wave-grad-${uid}`;

  const [displayPct, setDisplayPct] = useState(0);

  useEffect(() => {
    const target = Math.min(100, Math.max(0, levelPct));
    let startTimestamp: number | null = null;
    const duration = 1500;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayPct(Math.floor(easeOutQuart * target));
      if (progress < 1) window.requestAnimationFrame(step);
    };

    window.requestAnimationFrame(step);
  }, [levelPct]);

  const fillColor =
    displayPct < 20 ? "#EF4444" :
    displayPct < 40 ? "#F59E0B" :
    "#0D9E7E";

  const textColor =
    displayPct < 20 ? "#DC2626" :
    displayPct < 40 ? "#D97706" :
    "#059669";

  const innerTop    = size * 0.19;
  const innerBottom = size * 0.88;
  const innerHeight = innerBottom - innerTop;
  const fillHeight  = (displayPct / 100) * innerHeight;
  const fillY       = innerBottom - fillHeight;

  const dropPath = "M80 10 C80 10, 20 70, 20 105 C20 138 47 155 80 155 C113 155 140 138 140 105 C140 70 80 10 80 10 Z";

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox="0 0 160 160"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={dropPath} />
          </clipPath>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={fillColor} stopOpacity="0.9" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Drop outline */}
        <path
          d={dropPath}
          fill="white"
          stroke="#E5E7EB"
          strokeWidth="2"
        />

        {/* Water fill */}
        <g clipPath={`url(#${clipId})`}>
          <rect
            x="0"
            y={fillY}
            width="160"
            height={fillHeight + 20}
            fill={`url(#${gradId})`}
          />
          <path
            d={`M0 ${fillY} Q20 ${fillY-6} 40 ${fillY} Q60 ${fillY+6} 80 ${fillY} Q100 ${fillY-6} 120 ${fillY} Q140 ${fillY+6} 160 ${fillY} L160 160 L0 160 Z`}
            fill={fillColor}
            opacity="0.4"
          >
            <animate
              attributeName="d"
              dur="3s"
              repeatCount="indefinite"
              values={`
                M0 ${fillY} Q20 ${fillY-6} 40 ${fillY} Q60 ${fillY+6} 80 ${fillY} Q100 ${fillY-6} 120 ${fillY} Q140 ${fillY+6} 160 ${fillY} L160 160 L0 160 Z;
                M0 ${fillY} Q20 ${fillY+6} 40 ${fillY} Q60 ${fillY-6} 80 ${fillY} Q100 ${fillY+6} 120 ${fillY} Q140 ${fillY-6} 160 ${fillY} L160 160 L0 160 Z;
                M0 ${fillY} Q20 ${fillY-6} 40 ${fillY} Q60 ${fillY+6} 80 ${fillY} Q100 ${fillY-6} 120 ${fillY} Q140 ${fillY+6} 160 ${fillY} L160 160 L0 160 Z
              `}
            />
          </path>
        </g>

        {/* Text */}
        <text
          x="80"
          y="108"
          textAnchor="middle"
          fontSize="28"
          fontWeight="bold"
          fontFamily="Cairo, sans-serif"
          fill={displayPct > 45 ? "white" : textColor}
        >
          {displayPct}%
        </text>
      </svg>

      <span className="text-sm font-semibold" style={{ color: textColor }}>
        {displayPct < 20 ? "⚠️ حرج" : displayPct < 40 ? "⚡ منخفض" : "✅ طبيعي"}
      </span>
    </div>
  );
}