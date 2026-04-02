import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import {
  cropProfile,
  farm,
  cropTypeLookup,
  growthStageLookup,
} from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { CropProfileForm } from "./_components/crop-profile-form";
import { CropHistoryTable } from "./_components/crop-history-table";
import { WaterReqCard } from "./_components/water-req-card";
import { Skeleton } from "~/app/_components/UI/Skeleton";
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
      <div
        className="flex h-[60vh] flex-col items-center justify-center text-slate-400"
        dir="rtl"
      >
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
    <div
      className="mx-auto max-w-screen-2xl space-y-6 p-4 md:space-y-10 md:p-8"
      dir="rtl"
    >
      {/* Header */}
      <div>
        <h1 className="text-navy text-2xl font-semibold tracking-tight md:text-4xl">
          بروفايل المحاصيل
        </h1>
        <p className="mt-1 text-sm text-slate-500 md:mt-2 md:text-base">
          إدارة المحاصيل المزروعة ومراحل النمو والاحتياجات المائية
        </p>
      </div>

      {/* Form + Water Card */}
      <div className="grid grid-cols-1 gap-4 md:gap-8 lg:grid-cols-12">
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
            activeCropType={profile?.cropType ?? cropTypes[0]?.type ?? "wheat"}
            cropTypes={cropTypes}
          />
        </div>{" "}
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
