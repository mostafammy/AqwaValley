import { z } from "zod";

export const reportTypeValues = [
  "user_activity",
  "district_governance",
  "compliance",
  "audit_trail",
  "monthly_governance_pack",
] as const;

export const reportFormatValues = ["pdf", "csv", "xlsx"] as const;

export const reportScopeTypeValues = [
  "global",
  "district",
  "farm",
  "user",
] as const;

export const reportGenerationModeValues = ["strict", "partial"] as const;

export const reportGranularityValues = ["daily", "weekly", "monthly"] as const;

export type ReportType = (typeof reportTypeValues)[number];
export type ReportFormat = (typeof reportFormatValues)[number];
export type ReportScopeType = (typeof reportScopeTypeValues)[number];
export type ReportGenerationMode = (typeof reportGenerationModeValues)[number];

export const reportScopeSchema = z
  .object({
    scopeType: z.enum(reportScopeTypeValues).default("global"),
    districtId: z.string().uuid().optional(),
    farmId: z.string().uuid().optional(),
    userId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scopeType === "district" && !value.districtId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "districtId is required for district scope",
        path: ["districtId"],
      });
    }
    if (value.scopeType === "farm" && !value.farmId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "farmId is required for farm scope",
        path: ["farmId"],
      });
    }
    if (value.scopeType === "user" && !value.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "userId is required for user scope",
        path: ["userId"],
      });
    }
  });

export const reportRequestSchema = z
  .object({
    reportType: z.enum(reportTypeValues),
    formats: z.array(z.enum(reportFormatValues)).min(1),
    generationMode: z.enum(reportGenerationModeValues).default("strict"),
    timeRangeFrom: z.date().optional(),
    timeRangeTo: z.date().optional(),
    granularity: z.enum(reportGranularityValues).default("daily"),
    scope: reportScopeSchema,
    parameterSchemaVersion: z.string().default("report-params-v1"),
    templateVersion: z.string().min(1),
    policyVersion: z.string().min(1),
    maskingRulesVersion: z.string().min(1),
    snapshotId: z.string().min(1),
    snapshotType: z.enum(["logical", "physical"]).default("logical"),
    snapshotMetadata: z.record(z.unknown()).optional(),
    parameters: z.record(z.unknown()).default({}),
  })
  .refine(
    (value) =>
      !value.timeRangeFrom ||
      !value.timeRangeTo ||
      value.timeRangeFrom <= value.timeRangeTo,
    {
      message: "timeRangeFrom must be before or equal to timeRangeTo",
      path: ["timeRangeFrom"],
    },
  );

export type ReportRequestInput = z.infer<typeof reportRequestSchema>;

export type ReportData = {
  reportType: ReportType;
  generatedAtIso: string;
  scope: z.infer<typeof reportScopeSchema>;
  rows: Array<Record<string, unknown>>;
  aggregates?: Record<string, unknown>;
};

export type ExportResult = {
  format: ReportFormat;
  fileExtension: "pdf" | "csv" | "xlsx";
  contentType: string;
  payload: Buffer;
  outputHash: string;
};
