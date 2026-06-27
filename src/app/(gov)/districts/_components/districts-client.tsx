"use client";

import { useState } from "react";
import { LayoutGroup } from "framer-motion";
import { CenterList } from "./center-list";
import { WellsCanvas } from "./wells-canvas";
import { WellDetailsOverlay } from "./well-details-overlay";
import { MobileDistrictAccordion } from "./mobile-district-accordion";

export type WellWithAlerts = {
  id: string;
  name: string;
  status: "active" | "inactive" | "maintenance" | "offline" | "restricted";
  levelPct: number;
  flowRate: number | null;
  alertCount: number;
};

export type DistrictWithWells = {
  id: string; // slug for anchor
  dbId: string; // unique DB id for React key
  name: string;
  totalWells: number;
  activeWells: number;
  avgLevelPct: number;
  alertCount: number;
  depletionRate: number;
  wells: WellWithAlerts[];
};

interface DistrictsClientProps {
  districts: DistrictWithWells[];
}

export function DistrictsClient({ districts }: DistrictsClientProps) {
  // Default to first district if available
  const [selectedId, setSelectedId] = useState<string>(
    districts.length > 0 ? (districts[0]?.dbId ?? "") : ""
  );

  const selectedDistrict = districts.find((d) => d.dbId === selectedId);

  // State for the expanded well overlay
  const [expandedWellId, setExpandedWellId] = useState<string | null>(null);

  // Find the exact well object to pass to the overlay if expanded
  let expandedWell = null;
  if (expandedWellId) {
    for (const d of districts) {
      const found = d.wells.find((w) => w.id === expandedWellId);
      if (found) {
        expandedWell = found;
        break;
      }
    }
  }

  return (
    <LayoutGroup>
      {/* Mobile view: stacked accordion — each district expands to show its wells */}
      <div className="block md:hidden">
        <MobileDistrictAccordion
          districts={districts}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onExpandWell={setExpandedWellId}
        />
      </div>

      {/* Desktop view: side-by-side */}
      <div className="hidden flex-col gap-6 md:flex md:flex-row">
        {/* Right Column: Center List (Nav) - 30% */}
        <div className="w-full md:w-[30%] flex-shrink-0">
          <CenterList
            districts={districts}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Left Column: Wells Canvas - 70% */}
        {selectedDistrict && (
          <WellsCanvas
            district={selectedDistrict}
            onExpandWell={setExpandedWellId}
          />
        )}
      </div>

      {/* Full Screen Overlay for Expanded Well */}
      <WellDetailsOverlay
        well={expandedWell}
        onClose={() => setExpandedWellId(null)}
      />
    </LayoutGroup>
  );
}