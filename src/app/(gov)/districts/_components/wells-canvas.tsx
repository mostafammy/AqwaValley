import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type DistrictWithWells } from "./districts-client";
import { WellTile } from "./well-tile";

interface WellsCanvasProps {
  district: DistrictWithWells | undefined;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.1,
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 30 }
  },
};

export function WellsCanvas({ district }: WellsCanvasProps) {
  const [hoveredWellId, setHoveredWellId] = useState<string | null>(null);

  if (!district) return null;

  return (
    <div className="flex-1 bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] min-h-[500px]">
      <div className="flex flex-col gap-6">
        
        {/* District Summary Header */}
        <div className="flex items-center justify-between border-b border-[rgba(0,0,0,0.05)] pb-4">
          <div>
            <h2 className="text-[20px] font-bold text-[#1C1C1E]">{district.name}</h2>
            <p className="text-[12px] text-[#8E8E93] mt-1">
              إجمالي الآبار: {district.totalWells} · التنبيهات النشطة: {district.alertCount}
            </p>
          </div>
          
          <div className="flex gap-4 text-left">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wider">متوسط المنسوب</span>
              <span className="text-[18px] font-bold text-[#1C1C1E]">{Math.round(district.avgLevelPct)}%</span>
            </div>
            <div className="w-px bg-[rgba(0,0,0,0.05)]" />
            <div className="flex flex-col">
              <span className="text-[10px] text-[#8E8E93] font-semibold uppercase tracking-wider">معدل الانخفاض</span>
              <span className="text-[18px] font-bold text-[#1C1C1E]">{district.depletionRate} م/سنة</span>
            </div>
          </div>
        </div>

        {/* Wells Grid with AnimatePresence */}
        <AnimatePresence mode="wait">
          <motion.div
            key={district.dbId}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
          >
            {district.wells.map((well) => (
              <WellTile 
                key={well.id} 
                well={well} 
                variants={itemVariants} 
                dimmed={hoveredWellId !== null && hoveredWellId !== well.id}
                onHoverStart={() => setHoveredWellId(well.id)}
                onHoverEnd={() => setHoveredWellId(null)}
              />
            ))}
            {district.wells.length === 0 && (
              <div className="col-span-full py-12 text-center text-[#8E8E93] text-sm">
                لا توجد آبار في هذا المركز
              </div>
            )}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}
