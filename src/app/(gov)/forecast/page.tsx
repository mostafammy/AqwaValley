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
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">التوقعات المائية</h1>
        <p className="text-sm text-gray-500 mt-1">
          النماذج التنبؤية لاستدامة الخزان الجوفي
        </p>
      </div>

      <ForecastPageClient districts={districts} />
    </div>
  );
}
