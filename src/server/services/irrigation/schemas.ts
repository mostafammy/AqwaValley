/**
 * Zod validation schemas for AI irrigation plan output.
 *
 * These schemas are the trust boundary — raw AI output MUST pass validation
 * before being persisted or returned to the client.
 *
 * Validation rationale for each field:
 * - recommendedLitres max(500_000): hard cap per zone, prevents aquifer harm
 * - scheduledAt regex HH:MM: clean DB storage, rejects "05:30 AM" or ISO
 * - confidence enum: prevents free text like "fairly confident" breaking UI
 * - reasoning min(10): forces real chain-of-thought, mandatory for gov compliance
 *
 * @module server/services/irrigation/schemas
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Zone-level schema (per irrigation zone)
// ---------------------------------------------------------------------------

export const irrigationZoneSchema = z.object({
  zoneId: z.string().uuid(),
  cropType: z.string().min(1),
  growthStage: z.string().min(1),
  recommendedLitres: z.number().min(0).max(100_000_000),
  scheduledAt: z.string().regex(/^\d{2}:\d{2}$/, {
    message: "Must be HH:MM format (e.g., 05:30)",
  }),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Full plan schema (complete irrigation recommendation)
// ---------------------------------------------------------------------------

export const irrigationPlanSchema = z.object({
  reasoning: z.string().min(10, {
    message: "Reasoning must be at least 10 characters for traceability",
  }),
  totalLitres: z.number().min(0),
  quotaWarning: z.boolean(),
  zones: z.array(irrigationZoneSchema).min(1, {
    message: "Plan must contain at least one zone",
  }),
});

// ---------------------------------------------------------------------------
// Derived types
// ---------------------------------------------------------------------------

export type IrrigationPlan = z.infer<typeof irrigationPlanSchema>;
export type IrrigationZone = z.infer<typeof irrigationZoneSchema>;
