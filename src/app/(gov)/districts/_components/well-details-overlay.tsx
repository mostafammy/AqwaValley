import { motion, AnimatePresence } from "framer-motion";
import { X, Droplets, Activity, TrendingDown } from "lucide-react";
import { type WellWithAlerts } from "./districts-client";
import { useEffect } from "react";
import {ReadingsChart} from "~/app/(gov)/wells/[wellId]/_components/readings-chart";

interface WellDetailsOverlayProps {
  well: WellWithAlerts | null;
  onClose: () => void;
}

export function WellDetailsOverlay({ well, onClose }: WellDetailsOverlayProps) {
  // Lock body scroll when overlay is open
  useEffect(() => {
    if (well) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [well]);

  return (
    <AnimatePresence>
      {well && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-0 pointer-events-none sm:p-4 md:p-12">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="absolute inset-0 bg-[rgba(10,22,40,0.4)] backdrop-blur-md pointer-events-auto"
          />

          {/* Floating Expanded Object */}
          <motion.div
            layoutId={`well-card-${well.id}`}
            className="w-full max-w-5xl h-full sm:h-[85vh] bg-white rounded-none pointer-events-auto shadow-[0_30px_100px_rgba(0,0,0,0.15)] overflow-hidden relative flex flex-col z-10 sm:rounded-[24px]"
            transition={{ type: "spring", bounce: 0, duration: 0.55, opacity: { duration: 0.2 } }}
          >
            {/* Header section matching color context */}
            <div className="relative flex-shrink-0 p-4 border-b border-[rgba(0,0,0,0.05)] bg-[rgba(244,244,245,0.3)] sm:p-6 md:p-8">
              <button
                onClick={onClose}
                className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white border border-[rgba(0,0,0,0.05)] shadow-sm flex items-center justify-center text-[#8E8E93] hover:text-[#1C1C1E] transition-colors sm:top-6 sm:left-6 sm:w-10 sm:h-10"
                title="إغلاق"
              >
                <X size={18} className="sm:hidden" />
                <X size={20} className="hidden sm:block" />
              </button>

              <div className="flex items-center gap-3 mb-2 sm:gap-4">
                <span className="text-[36px] font-[800] tracking-[-0.05em] text-[#1C1C1E] leading-none sm:text-[48px]">
                  {(() => {
                    const match = /\d+/.exec(well.name);
                    return match ? match[0].padStart(2, "0") : well.name.slice(0, 2);
                  })()}
                </span>
                <div className="flex min-w-0 flex-col">
                  <h2 className="truncate text-base font-bold text-[#1C1C1E] sm:text-xl">{well.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: well.status === "active" ? "#34C759" :
                                         well.status === "offline" ? "#FF3B30" :
                                         well.status === "inactive" ? "#8E8E93" : "#FF9500"
                      }}
                    />
                    <span className="text-xs text-[#8E8E93] font-medium sm:text-sm">
                      {well.status === "active" ? "نشط" :
                      well.status === "offline" ? "متوقف" :
                      well.status === "inactive" ? "غير نشط" : "صيانة"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content area: Faders in after card explosion to hide layout reflow jank */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.1 } }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="p-4 flex-1 overflow-y-auto sm:p-6 md:p-8"
            >
              <div className="grid grid-cols-1 gap-3 mb-5 sm:grid-cols-3 sm:gap-6 sm:mb-8">
                {/* Stats Cards */}
                <div className="bg-[rgba(0,0,0,0.02)] p-4 rounded-[16px] border border-[rgba(0,0,0,0.04)] sm:p-6 sm:rounded-[20px]">
                   <div className="flex items-center gap-2 text-[#8E8E93] mb-3 sm:gap-3 sm:mb-4">
                     <Droplets size={18} className="text-[#1d6fa8] sm:size-5" />
                     <span className="text-xs font-bold sm:text-sm">مستوى المياه</span>
                   </div>
                   <div className="text-3xl font-black text-[#1C1C1E] tracking-tight sm:text-[40px]">
                     {Math.round(well.levelPct)}%
                   </div>
                </div>

                <div className="bg-[rgba(0,0,0,0.02)] p-4 rounded-[16px] border border-[rgba(0,0,0,0.04)] sm:p-6 sm:rounded-[20px]">
                   <div className="flex items-center gap-2 text-[#8E8E93] mb-3 sm:gap-3 sm:mb-4">
                     <Activity size={18} className="text-[#34C759] sm:size-5" />
                     <span className="text-xs font-bold sm:text-sm">معدل التدفق</span>
                   </div>
                    <div className="text-3xl font-black text-[#1C1C1E] tracking-tight sm:text-[40px]">
                      {well.flowRate ?? "—"} <span className="text-sm text-[#8E8E93] sm:text-base">م³/س</span>
                    </div>
                </div>

                <div className="bg-[rgba(0,0,0,0.02)] p-4 rounded-[16px] border border-[rgba(0,0,0,0.04)] sm:p-6 sm:rounded-[20px]">
                   <div className="flex items-center gap-2 text-[#8E8E93] mb-3 sm:gap-3 sm:mb-4">
                     <TrendingDown size={18} className="text-[#FF9500] sm:size-5" />
                     <span className="text-xs font-bold sm:text-sm">الاستهلاك اليومي</span>
                   </div>
                   <div className="text-3xl font-black text-[#1C1C1E] tracking-tight sm:text-[40px]">
                     {well.flowRate ? (well.flowRate * 24).toFixed(0) : "—"} <span className="text-sm text-[#8E8E93] sm:text-base">م³</span>
                   </div>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="mt-5 sm:mt-8"
              >
                <ReadingsChart
                  wellId={well.id}
                  depthM={null}
                  currentValue={well.levelPct}
                />
              </motion.div>            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}