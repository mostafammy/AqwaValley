import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import {
  cropProfile,
  farm,
  cropTypeLookup,
  growthStageLookup,
  farmWell,
  userRoleAssignment,
  role,
} from "~/server/db/schema";
import { eq, or } from "drizzle-orm";
import {
  CropProfileForm,
  type LiveSoilSnapshot,
} from "./_components/crop-profile-form";
import { CropHistoryTable } from "./_components/crop-history-table";
import { WaterReqCard } from "./_components/water-req-card";
import { Skeleton } from "~/app/_components/UI/Skeleton";
import { updateCropProfile } from "~/app/_actions/crops";
import { SignOutButton } from "~/app/_components/auth/SignOutButton";
import { SoilDataRepository } from "~/server/repositories/soil-data.repository";

export const metadata = { title: "بروفايل المحاصيل | AquaValley" };

async function hasAdminOrManagerRole(userId: string): Promise<boolean> {
  const userRoles = await db
    .select({ type: role.type })
    .from(userRoleAssignment)
    .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
    .where(eq(userRoleAssignment.userId, userId));

  const roleTypes = userRoles.map((r) => r.type);
  return roleTypes.includes("admin") || roleTypes.includes("district_manager");
}

async function loadFarmAndLookups(userId: string) {
  const farmQuery = db
    .select({ id: farm.id, name: farm.name, districtId: farm.districtId })
    .from(farm)
    .where(
      or(eq(farm.farmerUserId, userId), eq(farm.ownerId, userId)),
    )
    .limit(1);

  const [[farmerFarm], cropTypes, growthStages] = await Promise.all([
    farmQuery,
    db.select().from(cropTypeLookup),
    db.select().from(growthStageLookup),
  ]);

  let currentFarm: { id: string; name: string; districtId: string } | null =
    farmerFarm ?? null;

  if (!currentFarm && process.env.NODE_ENV === "development") {
    const isAdminOrManager = await hasAdminOrManagerRole(userId);
    if (isAdminOrManager && process.env.DEV_ALLOW_FALLBACK === "true") {
      const [fallbackFarm] = await db
        .select({ id: farm.id, name: farm.name, districtId: farm.districtId })
        .from(farm)
        .limit(1);
      currentFarm = fallbackFarm ?? null;
    }
  }

  return { currentFarm, cropTypes, growthStages };
}

async function loadLiveSoilSnapshot(farmId: string): Promise<LiveSoilSnapshot> {
  const wellIds = await db
    .select({ wellId: farmWell.wellId })
    .from(farmWell)
    .where(eq(farmWell.farmId, farmId))
    .then((rows) => rows.map((r) => r.wellId));

  if (wellIds.length === 0) {
    return { currentMoisturePct: null, wellCount: 0, lastUpdatedAt: null };
  }

  const repo = new SoilDataRepository();
  const readings = await repo.getLatestHumidityByWells(wellIds);
  if (readings.length === 0) {
    return { currentMoisturePct: null, wellCount: 0, lastUpdatedAt: null };
  }

  const avg =
    readings.reduce((sum, r) => sum + Number(r.value), 0) / readings.length;
  const lastUpdatedAt = readings
    .map((r) => new Date(r.lastUpdatedAt).getTime())
    .reduce((max, t) => (t > max ? t : max), 0);

  return {
    currentMoisturePct: Math.round(avg),
    wellCount: readings.length,
    lastUpdatedAt: new Date(lastUpdatedAt),
  };
}

export default async function CropsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const { currentFarm, cropTypes, growthStages } = await loadFarmAndLookups(
    session.user.id,
  );

  if (!currentFarm) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="max-w-md text-center">

          <h2 className="mb-2 text-xl font-bold text-gray-800">
            لا توجد مزرعة مرتبطة بحسابك
          </h2>
          <p className="mb-6 text-gray-600">
            يرجى التواصل مع مسؤول النظام لتخصيص مزرعة لحسابك، أو تحقق من بيانات
            اعتماد تسجيل الدخول الخاصة بك.
          </p>
          <SignOutButton className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
            العودة للرئيسية وتسجيل الخروج
          </SignOutButton>
        </div>
      </div>
    );
  }

  const [profile, liveSoil] = await Promise.all([
    db
      .select()
      .from(cropProfile)
      .where(eq(cropProfile.farmId, currentFarm.id))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    loadLiveSoilSnapshot(currentFarm.id),
  ]);

  return (
    <div
      className="mx-auto w-full max-w-screen-2xl space-y-6 overflow-x-hidden p-4 md:space-y-10 md:p-8"
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
            profile={profile}
            farmId={currentFarm.id}
            updateAction={updateCropProfile}
            cropTypes={cropTypes}
            growthStages={growthStages}
            liveSoil={liveSoil}
          />
        </div>
        <div className="lg:col-span-4">
          <WaterReqCard
            activeCropType={profile?.cropType ?? cropTypes[0]?.type ?? "wheat"}
            cropTypes={cropTypes}
          />
        </div>
      </div>

      {/* History Table */}
      <Suspense fallback={<Skeleton className="h-80 rounded-3xl" />}>
        <CropHistoryTable
          farmId={currentFarm.id}
          cropTypes={cropTypes}
          growthStages={growthStages}
        />
      </Suspense>
    </div>
  );
}