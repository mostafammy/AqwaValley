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
  activeCropType: string,
  cropTypes: CropType[]
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-teal-50 rounded-2xl flex items-center justify-center">
          <Droplets className="w-5 h-5 text-teal-600" />
        </div>
        <h3 className="text-base font-semibold text-navy">الاحتياجات المائية للمحاصيل</h3>
      </div>

      <div className="flex-1 space-y-3">
        {CROP_WATER_REQUIREMENTS.filter(c => cropTypes.some(t => t.type === c.type)).map((crop) => {
          const isActive = crop.type === activeCropType;
          const dbCrop = cropTypes.find(t => t.type === crop.type);
          return (
            <div
              key={crop.type}
              className={`
                rounded-2xl border p-4 transition-all
                ${isActive 
                  ? "border-teal-200 bg-teal-50" 
                  : "border-slate-100 bg-white"
                }
              `}
            >
              <div className="flex items-center justify-between">
                <span className={`font-medium ${isActive ? "text-teal-700" : "text-slate-700"}`}>
                  {dbCrop?.displayName ?? crop.nameAr}
                </span>
                <span className="text-xs text-slate-400 font-medium">{crop.season}</span>
              </div>
              <div className="mt-3 flex items-baseline justify-between text-sm">
                <span className="text-slate-500">{crop.waterMm} مم/موسم</span>
                <span className="font-medium text-slate-500">Kc = {crop.kc}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-slate-50 rounded-2xl text-xs text-slate-600 leading-relaxed border border-slate-100">
        قيم مرجعية لمناخ صحراوي — الوادي الجديد<br />
        ET₀ صيفي ≈ 8–12 مم/يوم
      </div>
    </div>
  );
}