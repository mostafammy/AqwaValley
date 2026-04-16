import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "~/lib/utils";
import { type WellWithAlerts } from "./districts-client";

interface WellTileProps {
  well: WellWithAlerts;
  variants?: any;
  dimmed?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  onClick?: () => void;
}

const TILT_MAX = 9;
const TILT_SPRING = { stiffness: 300, damping: 28 } as const;
const GLOW_SPRING = { stiffness: 180, damping: 22 } as const;

// Pseudo-random number generator seeded with a string and a number
function seededRandom(seedStr: string, numSeed: number, index: number) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0; 
  }
  const x = Math.sin(hash + numSeed * 13 + index * 97) * 10000;
  return x - Math.floor(x);
}

// Generate an SVG path for the sparkline
function generateSparkline(id: string, levelPct: number) {
  const points = [];
  const count = 7;
  const w = 100;
  const h = 24;  
  
  const targetY = h - (levelPct / 100) * h;
  
  for (let i = 0; i < count; i++) {
    const x = (i / (count - 1)) * w;
    if (i === count - 1) {
       points.push(`${x},${targetY}`);
    } else {
       const randomVariance = (seededRandom(id, levelPct, i) - 0.5) * 10;
       const y = Math.max(0, Math.min(h, targetY + randomVariance));
       points.push(`${x},${y}`);
    }
  }

  const d = `M0,${h} L${points.join(" L")} L${w},${h} Z`;
  return d;
}

export function WellTile({ well, variants, dimmed = false, onHoverStart, onHoverEnd, onClick }: WellTileProps) {
  const numMatch = well.name.match(/\d+/);
  const wellLabel = numMatch ? numMatch[0].padStart(2, '0') : well.name.slice(0, 2);

  // Status Colors
  let baseColor = "#8E8E93"; 
  let isCritical = false;

  switch (well.status) {
    case "active":
      baseColor = "#34C759";
      break;
    case "maintenance":
    case "restricted":
      baseColor = "#FF9500";
      break;
    case "offline":
      baseColor = "#FF3B30";
      isCritical = true;
      break;
  }

  const sparklineD = generateSparkline(well.id, well.levelPct);
  
  // Spotlight / 3D Tilt Logic
  const cardRef = useRef<HTMLButtonElement>(null);
  const normX = useMotionValue(0.5);
  const normY = useMotionValue(0.5);

  const rawRotateX = useTransform(normY, [0, 1], [TILT_MAX, -TILT_MAX]);
  const rawRotateY = useTransform(normX, [0, 1], [-TILT_MAX, TILT_MAX]);

  const rotateX = useSpring(rawRotateX, TILT_SPRING);
  const rotateY = useSpring(rawRotateY, TILT_SPRING);
  const glowOpacity = useSpring(0, GLOW_SPRING);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    normX.set((e.clientX - rect.left) / rect.width);
    normY.set((e.clientY - rect.top) / rect.height);
  };

  const handleMouseEnter = () => {
    glowOpacity.set(1);
    onHoverStart?.();
  };

  const handleMouseLeave = () => {
    normX.set(0.5);
    normY.set(0.5);
    glowOpacity.set(0);
    onHoverEnd?.();
  };

  return (
    <motion.div variants={variants} className="h-full block layout-id-wrapper">
      <button 
        onClick={onClick}
        type="button"
        className="block h-full w-full text-right outline-none cursor-pointer"
        ref={cardRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <motion.div
          layoutId={`well-card-${well.id}`}
          animate={{
            scale: dimmed ? 0.96 : 1,
            opacity: dimmed ? 0.5 : 1,
          }}
          style={{
            rotateX,
            rotateY,
            transformPerspective: 900,
          }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className={cn(
            "group relative flex flex-col justify-between overflow-hidden rounded-[16px] border p-5 h-full",
            "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
            "transition-[border-color] duration-300",
            "hover:border-zinc-300",
             isCritical && "well-critical-pulse border-[rgba(255,59,48,0.2)] shadow-[0_4px_20px_rgba(255,59,48,0.12)]"
          )}
        >
          {/* Static accent tint — always visible */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[16px]"
            style={{
              background: `radial-gradient(ellipse at 20% 20%, ${baseColor}14, transparent 65%)`,
            }}
          />

          {/* Hover glow layer */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[16px]"
            style={{
              opacity: glowOpacity,
              background: `radial-gradient(ellipse at 20% 20%, ${baseColor}2e, transparent 65%)`,
            }}
          />

          {/* Shimmer sweep */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-[55%] -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-black/5 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[280%]"
          />

          {/* Header */}
          <div className="relative z-10 flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span 
                className="w-1.5 h-1.5 rounded-full"
                style={{ 
                  backgroundColor: baseColor, 
                  boxShadow: baseColor !== "#8E8E93" ? `0 0 6px ${baseColor}` : "none" 
                }}
              />
              <span className="text-[32px] font-[800] tracking-[-0.05em] text-[#1C1C1E] leading-none mb-1">
                {wellLabel}
              </span>
            </div>
            {well.alertCount > 0 && (
              <span className="bg-red-50 text-red-600 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border border-red-200">
                {well.alertCount}
              </span>
            )}
          </div>

          <div className="relative z-10 flex-1 mt-2">
            {/* Micro Sparkline */}
            <div className="w-full h-[28px] relative rounded-md mb-3 overflow-hidden">
              <svg 
                viewBox="0 0 100 24" 
                preserveAspectRatio="none" 
                className="w-full h-full absolute bottom-0"
              >
                <path 
                  d={sparklineD} 
                  fill={`${baseColor}26`} // 15% opacity
                  stroke={`${baseColor}66`} // 40% opacity
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-[rgba(0,0,0,0.05)]">
              <span className="text-[10px] text-[#8E8E93] font-medium">المنسوب: {Math.round(well.levelPct)}%</span>
              <span className="text-[10px] text-[#8E8E93] font-medium">
                {well.flowRate != null ? `${well.flowRate} م³/س` : "—"}
              </span>
            </div>
          </div>

          {/* Accent bottom line */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-[3px] w-0 rounded-full transition-all duration-500 group-hover:w-full"
            style={{
              background: `linear-gradient(to right, transparent, ${baseColor}80, transparent)`,
            }}
          />
        </motion.div>
      </button>
    </motion.div>
  );
}
