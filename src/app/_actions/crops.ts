"use server";

import { db } from "~/server/db";
import {
  cropProfile,
  cropHistory,
  farm,
  cropTypeEnum,
  growthStageEnum,
} from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "~/server/better-auth/server";
import { z } from "zod";
import {
  computeExpectedHarvest,
  CROP_TARGET_MOISTURE,
} from "~/lib/crop-profile";

const UpdateCropSchema = z.object({
  farmId: z.string().uuid(),
  cropType: z.enum(cropTypeEnum.enumValues),
  growthStage: z.enum(growthStageEnum.enumValues),
  plantedDate: z.string().min(1, "تاريخ الزراعة مطلوب"),
});

export async function updateCropProfile(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = UpdateCropSchema.safeParse({
      farmId: formData.get("farmId"),
      cropType: formData.get("cropType"),
      growthStage: formData.get("growthStage"),
      plantedDate: formData.get("plantedDate"),
    });

    if (!parsed.success) {
      console.error("Validation error:", parsed.error);
      return { success: false, error: "بيانات غير صحيحة" };
    }

    const { farmId, cropType, growthStage, plantedDate } = parsed.data;

    const session = await getSession();
    if (!session?.user) {
      return { success: false, error: "غير مصرح لك" };
    }

    const [farmRecord] = await db
      .select({ ownerId: farm.ownerId })
      .from(farm)
      .where(eq(farm.id, farmId))
      .limit(1);

    if (!farmRecord?.ownerId || farmRecord.ownerId !== session.user.id) {
      return { success: false, error: "غير مصرح لك بتعديل هذه المزرعة" };
    }

    const targetMoisture = CROP_TARGET_MOISTURE[cropType]?.target ?? 55;
    const expectedHarvest = computeExpectedHarvest(
      plantedDate,
      growthStage,
    );

    await db.transaction(async (tx) => {
      const updatedRows = await tx
        .update(cropProfile)
        .set({
          cropType,
          growthStage,
          targetSoilMoisturePct: String(targetMoisture),
          plantedDate: new Date(plantedDate),
          expectedHarvestDate: expectedHarvest,
          updatedAt: new Date(),
        })
        .where(eq(cropProfile.farmId, farmId))
        .returning({ id: cropProfile.id });

      if (updatedRows.length === 0) {
        throw new Error("لم يتم العثور على بروفايل المحصول للمزرعة المحددة");
      }

      await tx.insert(cropHistory).values({
        farmId,
        cropType,
        growthStage,
        targetSoilMoisturePct: String(targetMoisture),
        plantedDate: new Date(plantedDate),
        expectedHarvestDate: expectedHarvest,
        harvestedDate: growthStage === "harvest" ? new Date() : null,
        recordedAt: new Date(),
      });
    });

    revalidatePath("/farm/crops");
    revalidatePath("/crops");
    return { success: true };
  } catch (err) {
    console.error("Update error:", err);
    return { success: false, error: "فشل الحفظ، حاول مرة أخرى" };
  }
}