import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { type DistrictWithWells } from "./districts-client";
import { WellTile } from "./well-tile";

interface WellsCanvasProps {
  district: DistrictWithWells | undefined;
  onExpandWell: (id: string) => void;
}

const containerVariants: Variants = {
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

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 30 }
  },
};

export function WellsCanvas({ district, onExpandWell }: WellsCanvasProps) {
  const [hoveredWellId, setHoveredWellId] = useState<string | null>(null);

  if (!district) return null;

  return (
    <div className="flex-1 bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] min-h-[500px]">
      <div className="flex flex-col gap-6">
        
        {/* District Summary Header */}
        <div className="flex items-center justify-between border-b border-[rgba(0,0,0,0.06)] pb-6 mb-2">
          <div>
            <h2 className="text-[22px] font-bold text-[#1C1C1E] tracking-tight">{district.name}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[12px] text-[#475569] font-medium">إجمالي الآبار: {district.totalWells}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <span className="text-[12px] text-[#475569] font-medium">التنبيهات النشطة: {district.alertCount}</span>
            </div>
          </div>
          
          <div className="flex gap-8 text-right">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#64748b] font-bold uppercase tracking-widest mb-1">متوسط المنسوب</span>
              <span className="text-[20px] font-bold text-[#1C1C1E]">{Math.round(district.avgLevelPct)}%</span>
            </div>
            <div className="w-px bg-[rgba(0,0,0,0.08)] my-1" />
            <div className="flex flex-col">
              <span className="text-[10px] text-[#64748b] font-bold uppercase tracking-widest mb-1">معدل الانخفاض</span>
              <span className="text-[20px] font-bold text-[#1C1C1E]">
                {district.depletionRate} 
                <span className="text-[12px] font-medium text-[#64748b] mr-1">م/سنة</span>
              </span>
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
                onClick={() => onExpandWell(well.id)}
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
