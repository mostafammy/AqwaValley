import { db } from "~/server/db";
import { well, district } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { MapClient } from "./map-client";
import type { WellMarker, OasisMarker } from "~/app/_components/UI/leaflet-map";

async function getWellMarkers(): Promise<WellMarker[]> {
  const rows = await db
    .select({
      id:           well.id,
      name:         well.name,
      lat:          well.latitude,
      lng:          well.longitude,
      status:       well.status,
      levelPct:     well.currentLevelPct,
      districtName: district.name,
    })
    .from(well)
    .leftJoin(district, eq(district.id, well.districtId));

  const validRows = rows.filter((r) => {
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  });

  const ALLOWED_STATUSES: WellMarker["status"][] = ["active", "inactive", "maintenance", "offline", "restricted"];

  return validRows.map((r) => {
    const rawStatus = r.status as WellMarker["status"];
    const status = ALLOWED_STATUSES.includes(rawStatus) ? rawStatus : "inactive";

    return {
      id:       r.id,
      name:     r.name,
      lat:      Number(r.lat),
      lng:      Number(r.lng),
      status:   status,
      levelPct: Number(r.levelPct ?? 0),
      district: r.districtName ?? "",
    };
  });
}

const OASIS_CENTERS: OasisMarker[] = [
  { id: "kharga",   name: "الخارجة",   lat: 25.4474, lng: 30.746 },
  { id: "dakhla",   name: "الداخلة",   lat: 25.4951, lng: 29.202 },
  { id: "farafra",  name: "الفرافرة",  lat: 27.0568, lng: 28.210 },
  { id: "paris",    name: "باريس",     lat: 24.7,    lng: 30.820 },
  { id: "balat",    name: "بلاط",      lat: 25.56,   lng: 29.49 },
];

export async function DistrictMap() {
  const markers = await getWellMarkers();

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold">
          🗺️ خريطة الآبار — الوادي الجديد
        </span>
        <span className="text-xs text-gray-400">{markers.length} بئر</span>
      </div>
      {/* overflow-hidden هنا بالظبط على الـ wrapper المباشر */}
      <div className="rounded-lg overflow-hidden" style={{ height: "470px" }}>
        <MapClient wells={markers} oases={OASIS_CENTERS} />
      </div>
    </div>
  );
}