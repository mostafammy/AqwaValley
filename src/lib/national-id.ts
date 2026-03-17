import { z } from "zod";

export const NATIONAL_ID_MIN_LENGTH = 8;
export const NATIONAL_ID_MAX_LENGTH = 20;

export const nationalIdSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "National ID must contain digits only")
  .min(
    NATIONAL_ID_MIN_LENGTH,
    `National ID must be at least ${NATIONAL_ID_MIN_LENGTH} digits`,
  )
  .max(
    NATIONAL_ID_MAX_LENGTH,
    `National ID must be at most ${NATIONAL_ID_MAX_LENGTH} digits`,
  );

export function normalizeNationalIdInput(value: string) {
  return value.replace(/\D/g, "");
}

export function maskNationalId(value: string) {
  if (value.length <= 4) {
    return value;
  }

  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}
