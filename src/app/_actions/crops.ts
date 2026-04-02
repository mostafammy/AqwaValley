"use server";

import { db } from "~/server/db";
import { cropProfile, cropHistory, farm, cropTypeEnum, growthStageEnum } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSession } from "~/server/better-auth/server";
import { z } from "zod";

const UpdateCropSchema = z.object({
  farmId:              z.string().uuid(),
  cropType:            z.enum(cropTypeEnum.enumValues),
  growthStage:         z.enum(growthStageEnum.enumValues),
  targetSoilMoisture:  z.string()
    .transform((v) => parseFloat(v))
    .refine((v) => Number.isFinite(v), { message: "يجب أن يكون رقمًا صالحًا" }),
  plantedDate:         z.string().optional(),
  expectedHarvestDate: z.string().optional(),
});

export async function updateCropProfile(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = UpdateCropSchema.safeParse({
      farmId:              formData.get("farmId"),
      cropType:            formData.get("cropType"),
      growthStage:         formData.get("growthStage"),
      targetSoilMoisture:  formData.get("targetSoilMoisture"),
      plantedDate:         formData.get("plantedDate"),
      expectedHarvestDate: formData.get("expectedHarvestDate"),
    });

    if (!parsed.success) {
      console.error("Validation error:", parsed.error);
      return { success: false, error: "بيانات غير صحيحة" };
    }

    const { farmId, cropType, growthStage, targetSoilMoisture, plantedDate, expectedHarvestDate } = parsed.data;

    // 0. Authorization check
    const session = await getSession();
    if (!session?.user) {
      return { success: false, error: "غير مصرح لك" };
    }

    const [farmRecord] = await db
      .select({ ownerId: farm.ownerId })
      .from(farm)
      .where(eq(farm.id, farmId))
      .limit(1);

    if (farmRecord?.ownerId !== session.user.id) {
      return { success: false, error: "غير مصرح لك بتعديل هذه المزرعة" };
    }

    // Use a transaction to ensure consistency
    await db.transaction(async (tx) => {
      // 1. Update the current profile
      const updatedRows = await tx
        .update(cropProfile)
        .set({
          cropType: cropType,
          growthStage: growthStage,
          targetSoilMoisturePct: String(targetSoilMoisture),
          plantedDate:           plantedDate ? new Date(plantedDate) : null,
          expectedHarvestDate:   expectedHarvestDate ? new Date(expectedHarvestDate) : null,
          updatedAt:             new Date(),
        })
        .where(eq(cropProfile.farmId, farmId))
        .returning({ id: cropProfile.id });

      if (updatedRows.length === 0) {
        throw new Error("لم يتم العثور على بروفايل المحصول للمزرعة المحددة");
      }

      // 2. Log this state in crop history
      await tx.insert(cropHistory).values({
        farmId,
        cropType:            cropType,
        growthStage:         growthStage,
        targetSoilMoisturePct: String(targetSoilMoisture),
        plantedDate:           plantedDate ? new Date(plantedDate) : null,
        expectedHarvestDate:   expectedHarvestDate ? new Date(expectedHarvestDate) : null,
        harvestedDate:       growthStage === "harvest" ? new Date() : null,
        recordedAt:          new Date(),
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