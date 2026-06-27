import { db } from "~/server/db";
import { district } from "~/server/db/schema";
import { asc } from "drizzle-orm";
import { ForecastPageClient } from "./_components/ForecastPageClient";

export const metadata = { title: "التوقعات المائية | AquaValley" };

export default async function ForecastPage() {
  const districts = await db.query.district.findMany({
    orderBy: [asc(district.name)],
  });

  return (
    <div className="min-w-0 space-y-3 overflow-x-hidden md:space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl leading-tight font-bold break-words sm:text-2xl md:text-3xl">
          التوقعات المائية
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-gray-500 sm:text-sm">
          النماذج التنبؤية لاستدامة الخزان الجوفي
        </p>
      </div>

      <ForecastPageClient districts={districts} />
    </div>
  );
}
