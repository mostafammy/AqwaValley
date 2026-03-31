import { or, eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { farm } from "~/server/db/schema";
import { AiPlanClient } from "./_components/AiPlanClient";

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

  // Fallback for development/demo
  if (!currentFarm && process.env.NODE_ENV === "development") {
    const fallbackRows = await db
      .select({ id: farm.id, name: farm.name })
      .from(farm)
      .limit(1);
    currentFarm = fallbackRows[0];
  }

  if (!currentFarm) {
    return (
      <div className="page h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">لم يتم العثور على مزرعة</h2>
        <p className="text-gray-500 max-w-sm">
          يجب أن تكون مرتبطاً بمزرعة لاستخدام نظام التوصيات الذكي. يرجى التواصل مع الإدارة.
        </p>
      </div>
    );
  }

  return <AiPlanClient farmId={currentFarm.id} farmName={currentFarm.name} />;
}
