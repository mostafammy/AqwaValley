import { or, eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { farm, userRoleAssignment, role } from "~/server/db/schema";
import { AiPlanClient } from "./_components/AiPlanClient";
import { SignOutButton } from "~/app/_components/auth/SignOutButton";

async function hasAdminOrManagerRole(userId: string): Promise<boolean> {
  const userRoles = await db
    .select({ type: role.type })
    .from(userRoleAssignment)
    .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
    .where(eq(userRoleAssignment.userId, userId));
  
  const roleTypes = userRoles.map((r) => r.type);
  return roleTypes.includes("admin") || roleTypes.includes("district_manager");
}

/**
 * AI Irrigation Plan Page (Server Component)
 * Resolves the current farm context and delegates to the AI Plan Client.
 */
export default async function AiPlanPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  // Resolve farm for the current user
  const farmRows = await db
    .select({ id: farm.id, name: farm.name })
    .from(farm)
    .where(
      or(
        eq(farm.farmerUserId, session.user.id),
        eq(farm.ownerId, session.user.id),
      ),
    )
    .orderBy(desc(farm.createdAt))
    .limit(1);

  let currentFarm = farmRows[0];

  // Fallback for development/demo - only when DEMO_MODE is explicitly enabled
  if (!currentFarm && process.env.NODE_ENV === "development") {
    const isAdminOrManager = await hasAdminOrManagerRole(session.user.id);
    if (isAdminOrManager && process.env.DEV_ALLOW_FALLBACK === "true") {
      const fallbackRows = await db
        .select({ id: farm.id, name: farm.name })
        .from(farm)
        .limit(1);
      currentFarm = fallbackRows[0];
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
            يرجى التواصل مع مسؤول النظام لتخصيص مزرعة لحسابك، أو تحقق من بيانات اعتماد تسجيل الدخول الخاصة بك.
          </p>
          <SignOutButton className="inline-block rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700">
            العودة للرئيسية وتسجيل الخروج
          </SignOutButton>
        </div>
      </div>
    );
  }
  return <AiPlanClient farmId={currentFarm.id} farmName={currentFarm.name} />;
}
