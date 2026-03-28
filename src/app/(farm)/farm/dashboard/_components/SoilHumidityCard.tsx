"use client";

import { ThermometerSun } from "lucide-react";
import type { SoilReading } from "../page";

type SoilHumidityCardProps = {
  soilReadings: SoilReading[];
};

export function SoilHumidityCard({ soilReadings }: SoilHumidityCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 md:p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2 text-base font-bold text-gray-800">
          <ThermometerSun className="w-5 h-5 text-teal-500" />
          حالة التربة (الرطوبة)
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {soilReadings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
            <span className="text-sm mt-2">لا توجد أجهزة استشعار رطوبة مرتبطة</span>
          </div>
        ) : (
          <div className="space-y-2">
            {soilReadings.map((reading) => (
              <div key={reading.sensorId} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: reading.value < 30 ? "var(--color-danger)" : "var(--color-teal)",
                    }}
                  />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-navy)" }}>
                    بئر {reading.wellId?.slice(0, 6) ?? ""}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>
                  {reading.value}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
