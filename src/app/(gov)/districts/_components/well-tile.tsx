import { useRef } from "react";
import { type Variants, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "~/lib/utils";
import { type WellWithAlerts } from "./districts-client";

interface WellTileProps {
  well: WellWithAlerts;
  variants?: Variants;
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
  const numMatch = /\d+/.exec(well.name);
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
          initial={false}
          whileHover={{ 
            y: -5,
            boxShadow: "0 12px 24px rgba(0,0,0,0.06)",
            borderColor: "rgba(0,0,0,0.15)",
          }}
          animate={{
            scale: dimmed ? 0.96 : 1,
            opacity: dimmed ? 0.5 : 1,
            y: 0,
            boxShadow: isCritical 
              ? "0 4px 12px rgba(220,38,38,0.1)" 
              : "0 2px 4px rgba(0,0,0,0.02)",
            borderColor: isCritical 
              ? "rgba(220,38,38,0.4)" 
              : "rgba(0,0,0,0.08)",
          }}
          style={{
            rotateX,
            rotateY,
            transformPerspective: 900,
          }}
          transition={{ 
            layout: { type: "spring", bounce: 0, duration: 0.55 },
            y: { type: "spring", stiffness: 400, damping: 25 },
            boxShadow: { duration: 0.2 },
            borderColor: { duration: 0.2 },
            opacity: { duration: 0.2 },
            scale: { duration: 0.2 }
          }}
          className={cn(
            "group relative flex flex-col justify-between overflow-hidden rounded-[20px] border p-6 h-full bg-white",
             isCritical && "bg-red-50/10"
          )}
        >
          {/* Subtle accent indicator */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 w-1 h-full opacity-60"
            style={{ backgroundColor: baseColor }}
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
            {/* Micro Sparkline with Baseline */}
            <div className="w-full h-[32px] relative rounded-md mb-4 overflow-hidden bg-gray-50/50">
              <svg 
                viewBox="0 0 100 24" 
                preserveAspectRatio="none" 
                className="w-full h-full absolute bottom-0"
              >
                {/* Contextual Baseline */}
                <line x1="0" y1="12" x2="100" y2="12" stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" strokeDasharray="2,2" />
                <path 
                  d={sparklineD} 
                  fill={`${baseColor}1A`} // 10% opacity for cleaner look
                  stroke={`${baseColor}CC`} // 80% opacity for better contrast
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            <div className="flex items-center justify-between mt-auto pt-3 border-t border-[rgba(0,0,0,0.06)]">
              <span className="text-[11px] text-[#475569] font-semibold">المنسوب: {Math.round(well.levelPct)}%</span>
              <span className="text-[11px] text-[#475569] font-semibold">
                {well.flowRate ?? "—"}
                {well.flowRate != null && " م³/س"}
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
