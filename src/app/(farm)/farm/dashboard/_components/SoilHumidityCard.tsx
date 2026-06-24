"use client";

import { ThermometerSun } from "lucide-react";
import type { SoilSensorReading } from "~/server/repositories/soil-data.repository";

type SoilHumidityCardProps = {
  soilReadings: SoilSensorReading[];
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
              <div key={reading.wellId} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-lg border border-transparent hover:border-gray-100">
                <div className="flex items-center gap-3">
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: reading.value < 30 ? "var(--color-danger)" : "var(--color-teal)",
                    }}
                  />
                  <div className="text-[13px] font-semibold text-navy">
                    {reading.wellName}
                  </div>
                </div>
                <div className="text-[14px] font-bold text-gray-800">
                  {Math.round(reading.value)}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
