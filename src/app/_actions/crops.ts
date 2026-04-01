"use server";

import { db } from "~/server/db";
import { cropProfile, cropHistory } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const UpdateCropSchema = z.object({
  farmId:              z.string().uuid(),
  cropType:            z.string(),
  growthStage:         z.string(),
  targetSoilMoisture:  z.string().transform((v) => parseFloat(v)),
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

    // Use a transaction to ensure consistency
    await db.transaction(async (tx) => {
      // 1. Update the current profile
      await tx
        .update(cropProfile)
        .set({
          cropType: cropType as any,
          growthStage: growthStage as any,
          targetSoilMoisturePct: String(targetSoilMoisture),
          plantedDate:           plantedDate ? new Date(plantedDate) : null,
          expectedHarvestDate:   expectedHarvestDate ? new Date(expectedHarvestDate) : null,
          updatedAt:             new Date(),
        })
        .where(eq(cropProfile.farmId, farmId));

      // 2. Log this state in crop history
      await tx.insert(cropHistory).values({
        farmId,
        cropType:            cropType as any,
        growthStage:         growthStage as any,
        targetSoilMoisturePct: String(targetSoilMoisture),
        plantedDate:           plantedDate ? new Date(plantedDate) : null,
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