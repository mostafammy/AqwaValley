import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { cropProfile, farm, cropTypeLookup, growthStageLookup } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { CropProfileForm }   from "./_components/crop-profile-form";
import { CropHistoryTable }  from "./_components/crop-history-table";
import { WaterReqCard }      from "./_components/water-req-card";
import { Skeleton }          from "~/app/_components/UI/Skeleton";
import { updateCropProfile } from "~/app/_actions/crops";

export const metadata = { title: "بروفايل المحاصيل | AquaValley" };

export default async function CropsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const [farmerFarm] = await db
    .select({ id: farm.id })
    .from(farm)
    .where(eq(farm.farmerUserId, session.user.id))
    .limit(1);

  if (!farmerFarm) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400" dir="rtl">
        <p className="text-sm font-medium">لم يتم تعيين مزرعة لهذا الحساب</p>
      </div>
    );
  }

  const [profile] = await db
    .select()
    .from(cropProfile)
    .where(eq(cropProfile.farmId, farmerFarm.id))
    .limit(1);

  const cropTypes = await db.select().from(cropTypeLookup);
  const growthStages = await db.select().from(growthStageLookup);

  return (
    <div className="p-6 md:p-8 space-y-10 max-w-screen-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-navy">بروفايل المحاصيل</h1>
        <p className="text-slate-500 mt-2">إدارة المحاصيل المزروعة ومراحل النمو والاحتياجات المائية</p>
      </div>

      {/* Form + Water Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <CropProfileForm
            profile={profile ?? null}
            farmId={farmerFarm.id}
            updateAction={updateCropProfile}
            cropTypes={cropTypes}
            growthStages={growthStages}
          />
        </div>
        <div className="lg:col-span-4">
          <WaterReqCard 
            activeCropType={profile?.cropType ?? "wheat"} 
            cropTypes={cropTypes}
          />
        </div>
      </div>

      {/* History Table */}
      <Suspense fallback={<Skeleton className="h-80 rounded-3xl" />}>
        <CropHistoryTable 
          farmId={farmerFarm.id} 
          cropTypes={cropTypes}
          growthStages={growthStages}
        />
      </Suspense>
    </div>
  );
}