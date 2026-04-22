import { type Dispatch, type SetStateAction, useRef } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { MapPin, AlertTriangle } from "lucide-react";
import { cn } from "~/lib/utils";
import { type DistrictWithWells } from "./districts-client";

interface CenterListProps {
  districts: DistrictWithWells[];
  selectedId: string;
  onSelect: Dispatch<SetStateAction<string>>;
}

const GLOW_SPRING = { stiffness: 180, damping: 22 } as const;

function CenterCard({ 
  district: d, 
  isActive, 
  onSelect 
}: { 
  district: DistrictWithWells; 
  isActive: boolean; 
  onSelect: () => void;
}) {
  const cardRef = useRef<HTMLButtonElement>(null);
  
  // Spotlight Glow Logic
  const normX = useMotionValue(0.5);
  const normY = useMotionValue(0.5);
  const glowOpacity = useSpring(0, GLOW_SPRING);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    normX.set((e.clientX - rect.left) / rect.width);
    normY.set((e.clientY - rect.top) / rect.height);
  };

  const handleMouseEnter = () => glowOpacity.set(1);
  const handleMouseLeave = () => {
    normX.set(0.5);
    normY.set(0.5);
    glowOpacity.set(0);
  };

  // Status Bar Calculation
  const total = d.totalWells || 1;
  let activeCount = 0, warningCount = 0, offlineCount = 0, disabledCount = 0;
  
  for (const w of d.wells) {
    if (w.status === "active") activeCount++;
    else if (w.status === "offline") offlineCount++;
    else if (w.status === "inactive") disabledCount++;
    else warningCount++;
  }

  const activePct = (activeCount / total) * 100;
  const warningPct = (warningCount / total) * 100;
  const offlinePct = (offlineCount / total) * 100;
  const disabledPct = (disabledCount / total) * 100;

  // Pulse effect if district has alerts or offline wells
  const hasCritical = offlineCount > 0;

  return (
    <div className="relative">
      {/* Animated Active Background (Framer Motion shared layout layoutId) */}
      {isActive && (
        <>
          <motion.div
            layoutId="active-district-bg"
            className="absolute inset-0 bg-[#F8FBFF] rounded-[16px] shadow-[0_4px_12px_rgba(29,111,168,0.06)] border-2 border-[var(--color-blue)]"
            initial={false}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
          {/* Ambient Glow - Refined */}
          <motion.div
            layoutId="active-district-glow"
            className="absolute -inset-2 opacity-5 blur-xl rounded-[30px] pointer-events-none z-0"
            style={{
              background: offlineCount > 0 ? "#EF4444" : warningCount > 0 ? "#F59E0B" : "#1D6FA8",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.06 }}
            transition={{ duration: 0.6 }}
          />
        </>
      )}

      <button
        ref={cardRef}
        onClick={onSelect}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        className={cn(
          "w-full text-right p-5 rounded-[16px] flex flex-col gap-4 relative z-10 overflow-hidden outline-none",
          !isActive && "bg-[rgba(255,255,255,0.4)] border border-[rgba(0,0,0,0.06)] hover:bg-[rgba(255,255,255,0.8)] transition-colors duration-300"
        )}
      >
        {/* Dynamic Hover Aurora inside button */}
        {!isActive && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              opacity: glowOpacity,
              background: `radial-gradient(circle at 50% 50%, rgba(29, 111, 168, 0.08), transparent 70%)`,
            }}
          />
        )}

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm",
              isActive ? "bg-blue-50 text-[var(--color-blue)] shadow-blue-100/50" : "bg-gray-50 text-[#8E8E93] border border-gray-100"
            )}>
              <MapPin size={18} strokeWidth={2.2} />
            </div>
            <span className={cn(
              "text-[15px] font-bold tracking-tight transition-colors duration-300",
              isActive ? "text-[var(--color-blue)]" : "text-[#1C1C1E]"
            )}>
              {d.name}
            </span>
          </div>
          
          <AnimatePresence>
            {d.alertCount > 0 && (
              <motion.span 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border",
                  hasCritical 
                    ? "bg-red-50 text-red-600 border-red-200 well-critical-pulse shadow-[0_0_12px_rgba(255,59,48,0.2)]" 
                    : "bg-amber-50 text-amber-600 border-amber-200"
                )}
              >
                <AlertTriangle size={12} strokeWidth={3} />
                {d.alertCount}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Precision Status Bar */}
        <div className="relative z-10 w-full h-[4px] bg-[rgba(0,0,0,0.06)] flex gap-[2px] overflow-hidden rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
          {activePct > 0 && (
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${activePct}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
              className="h-full relative overflow-hidden rounded-sm"
              style={{ background: "linear-gradient(to bottom, #10B981, #059669)" }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.25),transparent_60%)] z-10" />
            </motion.div>
          )}
          {warningPct > 0 && (
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${warningPct}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.15 }}
              className="h-full relative overflow-hidden rounded-sm"
              style={{ background: "linear-gradient(to bottom, #F59E0B, #D97706)" }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.25),transparent_60%)] z-10" />
            </motion.div>
          )}
          {offlinePct > 0 && (
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${offlinePct}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
              className="h-full relative overflow-hidden rounded-sm"
              style={{ background: "linear-gradient(to bottom, #EF4444, #DC2626)" }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.25),transparent_60%)] z-10" />
            </motion.div>
          )}
          {disabledPct > 0 && (
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${disabledPct}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.25 }}
              className="h-full relative overflow-hidden rounded-sm"
              style={{ background: "linear-gradient(to bottom, #94A3B8, #64748B)" }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.25),transparent_60%)] z-10" />
            </motion.div>
          )}
        </div>

        <div className="relative z-10 flex items-center gap-3 text-[12px] font-medium transition-colors duration-300">
          <div className={cn("flex items-center gap-1", isActive ? "text-[var(--color-ok)]" : "text-[#8E8E93]")}>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)]" />
            {activeCount} نشط
          </div>
          
          {(warningCount > 0 || offlineCount > 0) && <div className="w-px h-3 bg-[rgba(0,0,0,0.1)]" />}
          
          {warningCount > 0 && (
            <div className={cn("flex items-center gap-1", isActive ? "text-[var(--color-warn)]" : "text-[#8E8E93]")}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warn)]" />
              {warningCount} صيانة
            </div>
          )}
          
          {offlineCount > 0 && (
            <div className="flex items-center gap-1 text-[var(--color-danger)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger)]" />
              {offlineCount} متوقف
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

export function CenterList({ districts, selectedId, onSelect }: CenterListProps) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {districts.map((d) => (
        <CenterCard 
          key={d.dbId} 
          district={d} 
          isActive={d.dbId === selectedId} 
          onSelect={() => onSelect(d.dbId)} 
        />
      ))}
    </div>
  );
}
