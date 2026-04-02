import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { farm } from "~/server/db/schema";

import { IrrigateClient } from "./_components/IrrigateClient";

export default async function IrrigatePage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const farmRows = await db
    .select({
      id: farm.id,
      name: farm.name,
      districtId: farm.districtId,
      monthlyQuotaM3: farm.monthlyQuotaM3,
      status: farm.status,
    })
    .from(farm)
    .where(or(eq(farm.farmerUserId, session.user.id), eq(farm.ownerId, session.user.id)))
    .orderBy(farm.createdAt)
    .limit(1);

  let currentFarm = farmRows[0];

  if (
    !currentFarm &&
    process.env.NODE_ENV === "development" &&
    process.env.DEV_ALLOW_FALLBACK === "true"
  ) {
    const fallbackRows = await db
      .select({
        id: farm.id,
        name: farm.name,
        districtId: farm.districtId,
        monthlyQuotaM3: farm.monthlyQuotaM3,
        status: farm.status,
      })
      .from(farm)
      .limit(1);
    currentFarm = fallbackRows[0];
  }

  if (!currentFarm) {
    return (
      <div className="p-6 md:p-8" dir="rtl">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-6 text-6xl opacity-10">🌾</div>
          <p className="text-lg text-gray-500">لم يتم العثور على مزرعة مرتبطة بحسابك.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 p-4 md:space-y-8 md:p-6"
      dir="rtl"
      style={{ animation: "fadeSlideUp 0.6s ease-out both" }}
    >
      <IrrigateClient farmId={currentFarm.id} farmName={currentFarm.name} />
    </div>
  );
}