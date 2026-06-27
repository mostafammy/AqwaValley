import { Droplets } from "lucide-react";

const CROP_WATER_REQUIREMENTS = [
  {
    type:       "wheat",
    nameAr:     "قمح",
    waterMm:    "450–650",
    kc:         "1.15",
    season:     "شتوي",
  },
  {
    type:       "corn",
    nameAr:     "ذرة",
    waterMm:    "500–800",
    kc:         "1.20",
    season:     "صيفي",
  },
  {
    type:       "vegetables",
    nameAr:     "خضروات",
    waterMm:    "300–500",
    kc:         "1.05",
    season:     "متعدد",
  },
  {
    type:       "fruits",
    nameAr:     "نخيل تمر",
    waterMm:    "1500–2000",
    kc:         "1.00",
    season:     "دائم",
  },
  {
    type:       "other",
    nameAr:     "برسيم",
    waterMm:    "800–1200",
    kc:         "1.10",
    season:     "متعدد",
  },
] as const;

interface CropType {
  type: string;
  displayName: string;
}

export function WaterReqCard({ 
  activeCropType, 
  cropTypes 
}: { 
  activeCropType: string | undefined,
  cropTypes: CropType[]
}) {
  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-teal-50">
          <Droplets className="h-5 w-5 text-teal-600" />
        </div>
        <h3 className="text-navy text-base font-semibold break-words">الاحتياجات المائية للمحاصيل</h3>
      </div>

      <div className="flex-1 space-y-3">
        {CROP_WATER_REQUIREMENTS.filter(c => cropTypes.some(t => t.type === c.type)).map((crop) => {
          const isActive = crop.type === activeCropType;
          const dbCrop = cropTypes.find(t => t.type === crop.type);
          return (
            <div
              key={crop.type}
              className={`
                rounded-2xl border p-3 transition-all sm:p-4
                ${isActive
                  ? "border-teal-200 bg-teal-50"
                  : "border-slate-100 bg-white"
                }
              `}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`min-w-0 break-words font-medium ${isActive ? "text-teal-700" : "text-slate-700"}`}>
                  {dbCrop?.displayName ?? crop.nameAr}
                </span>
                <span className="shrink-0 text-xs font-medium text-slate-400">{crop.season}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-sm">
                <span className="text-slate-500">{crop.waterMm} مم/موسم</span>
                <span className="font-medium text-slate-500">Kc = {crop.kc}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 sm:mt-8">
        قيم مرجعية لمناخ صحراوي — الوادي الجديد<br />
        ET₀ صيفي ≈ 8–12 مم/يوم
      </div>
    </div>
  );
}