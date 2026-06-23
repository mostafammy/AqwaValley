import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import {
  adminProcedure,
  createTRPCRouter,
  viewerProcedure,
} from "~/server/api/trpc";
import type { DrizzleDB } from "~/server/db";
import { reportArtifact, reportJob } from "~/server/db/schema";
import { ReportAccessPolicy } from "~/server/services/reporting/ReportAccessPolicy";
import { ReportingOrchestrator } from "~/server/services/reporting/ReportingOrchestrator";
import {
  reportRequestSchema,
  reportScopeSchema,
  reportTypeValues,
} from "~/server/services/reporting/types";

const listJobsInputSchema = z.object({
  status: z
    .enum([
      "queued",
      "processing",
      "completed",
      "partial_failed",
      "failed",
      "cancelled",
    ])
    .optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

const runMonthlyPackInput = z.object({
  districtId: z.string().uuid().optional(),
  snapshotId: z.string().min(1),
  templateVersion: z.string().min(1).default("v1"),
  policyVersion: z.string().min(1).default("policy-current"),
  maskingRulesVersion: z.string().min(1).default("masking-current"),
});

function buildReportingDependencies(db: DrizzleDB) {
  return {
    orchestrator: new ReportingOrchestrator(db),
    policy: new ReportAccessPolicy(),
  };
}

export const reportsRouter = createTRPCRouter({
  requestGeneration: viewerProcedure
    .input(reportRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const deps = buildReportingDependencies(ctx.db);

      await deps.policy.assertCanRequest(ctx, input);

      return deps.orchestrator.requestReport({
        actorId: ctx.session.user.id,
        input,
      });
    }),

  processQueue: adminProcedure
    .input(
      z.object({
        maxJobs: z.number().int().min(1).max(50).default(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const deps = buildReportingDependencies(ctx.db);
      return deps.orchestrator.processQueue({
        actorId: ctx.session.user.id,
        maxJobs: input.maxJobs,
      });
    }),

  listJobs: viewerProcedure
    .input(listJobsInputSchema)
    .query(async ({ ctx, input }) => {
      const deps = buildReportingDependencies(ctx.db);
      return deps.orchestrator.listJobs({
        actorId: ctx.session.user.id,
        actorRoles: ctx.userRoles,
        status: input.status,
        page: input.page,
        pageSize: input.pageSize,
      });
    }),

  getJob: viewerProcedure
    .input(z.object({ reportJobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const deps = buildReportingDependencies(ctx.db);
      const result = await deps.orchestrator.getJobWithArtifacts(
        input.reportJobId,
      );

      deps.policy.assertCanViewJob({
        actorId: ctx.session.user.id,
        actorRoles: ctx.userRoles,
        requestedBy: result.job.requestedBy,
      });

      return result;
    }),

  getDownloadLink: viewerProcedure
    .input(z.object({ reportArtifactId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const deps = buildReportingDependencies(ctx.db);

      const artifact = await ctx.db.query.reportArtifact.findFirst({
        where: and(
          eq(reportArtifact.id, input.reportArtifactId),
          eq(reportArtifact.status, "ready"),
        ),
        columns: {
          reportJobId: true,
        },
      });

      if (!artifact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report artifact is not available",
        });
      }

      const job = await ctx.db.query.reportJob.findFirst({
        where: eq(reportJob.id, artifact.reportJobId),
        columns: {
          requestedBy: true,
        },
      });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Report job not found",
        });
      }

      deps.policy.assertCanViewJob({
        actorId: ctx.session.user.id,
        actorRoles: ctx.userRoles,
        requestedBy: job.requestedBy,
      });

      return deps.orchestrator.resolveDownload({
        actorId: ctx.session.user.id,
        reportArtifactId: input.reportArtifactId,
      });
    }),

  runMonthlyGovernancePack: viewerProcedure
    .input(runMonthlyPackInput)
    .mutation(async ({ ctx, input }) => {
      const deps = buildReportingDependencies(ctx.db);

      const scope =
        input.districtId == null
          ? reportScopeSchema.parse({ scopeType: "global" })
          : reportScopeSchema.parse({
              scopeType: "district",
              districtId: input.districtId,
            });

      const request = reportRequestSchema.parse({
        reportType: "monthly_governance_pack",
        formats: ["pdf", "csv", "xlsx"],
        generationMode: "strict",
        granularity: "monthly",
        scope,
        parameterSchemaVersion: "report-params-v1",
        templateVersion: input.templateVersion,
        policyVersion: input.policyVersion,
        maskingRulesVersion: input.maskingRulesVersion,
        snapshotId: input.snapshotId,
        snapshotType: "logical",
        snapshotMetadata: {
          trigger: "one_click_monthly_pack",
        },
        parameters: {
          reportType: "monthly_governance_pack",
          districtId: input.districtId ?? null,
        },
      });

      await deps.policy.assertCanRequest(ctx, request);

      return deps.orchestrator.requestReport({
        actorId: ctx.session.user.id,
        input: request,
      });
    }),

  getSupportedReportTypes: viewerProcedure.query(async () => {
    return reportTypeValues;
  }),

  validateScope: viewerProcedure
    .input(reportScopeSchema)
    .query(async ({ ctx, input }) => {
      const deps = buildReportingDependencies(ctx.db);

      const syntheticRequest = reportRequestSchema.parse({
        reportType: "user_activity",
        formats: ["csv"],
        generationMode: "strict",
        granularity: "daily",
        scope: input,
        parameterSchemaVersion: "report-params-v1",
        templateVersion: "v1",
        policyVersion: "policy-current",
        maskingRulesVersion: "masking-current",
        snapshotId: "scope-validation",
        snapshotType: "logical",
        parameters: {},
      });

      try {
        await deps.policy.assertCanRequest(ctx, syntheticRequest);
        return { allowed: true as const };
      } catch (error) {
        if (error instanceof TRPCError && error.code === "FORBIDDEN") {
          return { allowed: false as const, reason: error.message };
        }
        throw error;
      }
    }),

  deleteJob: viewerProcedure
    .input(z.object({ reportJobId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deps = buildReportingDependencies(ctx.db);
      const result = await deps.orchestrator.getJobWithArtifacts(
        input.reportJobId,
      );

      deps.policy.assertCanViewJob({
        actorId: ctx.session.user.id,
        actorRoles: ctx.userRoles,
        requestedBy: result.job.requestedBy,
      });

      await deps.orchestrator.deleteJob(input.reportJobId);
      return { success: true };
    }),
});
