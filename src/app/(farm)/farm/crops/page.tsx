import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import {
  cropProfile,
  farm,
  cropTypeLookup,
  growthStageLookup,
  userRoleAssignment,
  role,
} from "~/server/db/schema";
import { eq, or } from "drizzle-orm";
import { CropProfileForm } from "./_components/crop-profile-form";
import { CropHistoryTable } from "./_components/crop-history-table";
import { WaterReqCard } from "./_components/water-req-card";
import { Skeleton } from "~/app/_components/UI/Skeleton";
import { updateCropProfile } from "~/app/_actions/crops";
import { SignOutButton } from "~/app/_components/auth/SignOutButton";

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

export default async function CropsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const [farmerFarm] = await db
    .select({ id: farm.id })
    .from(farm)
    .where(
      or(
        eq(farm.farmerUserId, session.user.id),
        eq(farm.ownerId, session.user.id),
      ),
    )
    .limit(1);

  let currentFarm = farmerFarm;

  if (!currentFarm && process.env.NODE_ENV === "development") {
    const isAdminOrManager = await hasAdminOrManagerRole(session.user.id);
    if (isAdminOrManager && process.env.DEV_ALLOW_FALLBACK === "true") {
      const [fallbackFarm] = await db
        .select({ id: farm.id })
        .from(farm)
        .limit(1);
      currentFarm = fallbackFarm;
    }
  }

  if (!currentFarm) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">🚫</div>
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
