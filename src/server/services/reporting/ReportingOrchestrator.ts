import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { unlink } from "fs/promises";

import type { DBConnection } from "~/server/db";
import {
  auditLog,
  reportArtifact,
  reportAuditLog,
  reportJob,
  farm,
  user,
  userProfile,
} from "~/server/db/schema";
import { logger } from "~/lib/logger";
import { buildReportFingerprint } from "./normalization";
import {
  CsvExportStrategy,
  ExportEngine,
  PdfExportStrategy,
  XlsxExportStrategy,
} from "./exporters";
import type { ReportData, ReportRequestInput } from "./types";
import { persistArtifact, resolveArtifactAbsolutePath } from "./storage";

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function generateStorageKey(params: {
  jobId: string;
  format: "pdf" | "csv" | "xlsx";
}): string {
  const ext = params.format;
  return `reports/${params.jobId}/${params.jobId}.${ext}`;
}

export class ReportingOrchestrator {
  private readonly exportEngine = new ExportEngine([
    new PdfExportStrategy(),
    new CsvExportStrategy(),
    new XlsxExportStrategy(),
  ]);

  constructor(private readonly db: DBConnection) {}

  async requestReport(params: {
    actorId: string;
    input: ReportRequestInput;
  }): Promise<{ reportJobId: string; reused: boolean; status: string }> {
    const fingerprint = buildReportFingerprint({
      reportType: params.input.reportType,
      parameters: params.input.parameters,
      scope: params.input.scope,
      timeRangeFrom: params.input.timeRangeFrom,
      timeRangeTo: params.input.timeRangeTo,
      granularity: params.input.granularity,
      snapshotId: params.input.snapshotId,
      templateVersion: params.input.templateVersion,
      policyVersion: params.input.policyVersion,
    });

    const [created] = await this.db
      .insert(reportJob)
      .values({
        reportType: params.input.reportType,
        status: "queued",
        generationMode: params.input.generationMode,
        requestedBy: params.actorId,
        scopeType: params.input.scope.scopeType,
        scopeDistrictId: params.input.scope.districtId,
        scopeFarmId: params.input.scope.farmId,
        scopeUserId: params.input.scope.userId,
        timeRangeFrom: params.input.timeRangeFrom,
        timeRangeTo: params.input.timeRangeTo,
        granularity: params.input.granularity,
        parameterSchemaVersion: params.input.parameterSchemaVersion,
        normalizedParametersHash: fingerprint.hash,
        snapshotId: params.input.snapshotId,
        snapshotType: params.input.snapshotType,
        snapshotMetadata: {
          ...params.input.snapshotMetadata,
          requestedFormats: params.input.formats,
          normalizedParameters: fingerprint.canonical,
          parameters: params.input.parameters,
        },
        templateVersion: params.input.templateVersion,
        policyVersion: params.input.policyVersion,
        maskingRulesVersion: params.input.maskingRulesVersion,
      })
      .onConflictDoNothing({
        target: [
          reportJob.reportType,
          reportJob.normalizedParametersHash,
          reportJob.snapshotId,
          reportJob.templateVersion,
          reportJob.policyVersion,
        ],
      })
      .returning({ id: reportJob.id, status: reportJob.status });

    if (!created) {
      const existing = await this.db.query.reportJob.findFirst({
        where: and(
          eq(reportJob.reportType, params.input.reportType),
          eq(reportJob.normalizedParametersHash, fingerprint.hash),
          eq(reportJob.snapshotId, params.input.snapshotId),
          eq(reportJob.templateVersion, params.input.templateVersion),
          eq(reportJob.policyVersion, params.input.policyVersion),
        ),
        columns: { id: true, status: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create or resolve report job",
        });
      }

      return {
        reportJobId: existing.id,
        reused: true,
        status: existing.status,
      };
    }

    await this.db.insert(reportAuditLog).values({
      reportJobId: created.id,
      actorId: params.actorId,
      actionType: "requested",
      details: {
        reportType: params.input.reportType,
        formats: params.input.formats,
        snapshotId: params.input.snapshotId,
      },
    });

    return { reportJobId: created.id, reused: false, status: created.status };
  }

  async processQueue(params: {
    actorId?: string;
    maxJobs: number;
  }): Promise<{ scanned: number; completed: number; failed: number }> {
    const queued = await this.db.query.reportJob.findMany({
      where: eq(reportJob.status, "queued"),
      orderBy: [asc(reportJob.createdAt)],
      limit: Math.max(1, Math.min(50, params.maxJobs)),
    });

    let completed = 0;
    let failed = 0;

    for (const job of queued) {
      try {
        const updated = await this.db
          .update(reportJob)
          .set({
            status: "processing",
            startedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(reportJob.id, job.id), eq(reportJob.status, "queued")))
          .returning({ id: reportJob.id });

        if (!updated.length) continue;

        const snapshotMetadata = (job.snapshotMetadata ?? {}) as Record<
          string,
          unknown
        >;
        const requestFormats = (snapshotMetadata.requestedFormats ?? [
          "pdf",
        ]) as Array<"pdf" | "csv" | "xlsx">;

        const data = await this.buildReportData({
          reportType: job.reportType,
          scopeType: job.scopeType,
          scopeDistrictId: job.scopeDistrictId,
          scopeFarmId: job.scopeFarmId,
          scopeUserId: job.scopeUserId,
          timeRangeFrom: job.timeRangeFrom,
          timeRangeTo: job.timeRangeTo,
        });

        const isPartialMode = job.generationMode === "partial";
        const now = new Date();
        const successfulFormats: Array<"pdf" | "csv" | "xlsx"> = [];
        const failedFormats: Array<{
          format: "pdf" | "csv" | "xlsx";
          reason: string;
        }> = [];

        for (const format of requestFormats) {
          try {
            const [result] = await this.exportEngine.exportMany({
              formats: [format],
              data,
              templateVersion: job.templateVersion,
              metadata: {
                reportJobId: job.id,
                snapshotId: job.snapshotId,
                policyVersion: job.policyVersion,
                maskingRulesVersion: job.maskingRulesVersion,
              },
            });

            if (!result) {
              throw new Error("Exporter did not return a result");
            }

            const storageKey = generateStorageKey({
              jobId: job.id,
              format: result.format,
            });
            const persisted = await persistArtifact({
              storageKey,
              payload: result.payload,
            });

            await this.db
              .insert(reportArtifact)
              .values({
                reportJobId: job.id,
                format: result.format,
                status: "ready",
                storageKey,
                contentType: result.contentType,
                fileSizeBytes: persisted.sizeBytes,
                outputHash: result.outputHash,
                metadata: {
                  storage: "local-file-system",
                  deterministic: true,
                },
                readyAt: now,
                expiresAt: addDays(now, 7),
              })
              .onConflictDoUpdate({
                target: [reportArtifact.reportJobId, reportArtifact.format],
                set: {
                  status: "ready",
                  storageKey,
                  contentType: result.contentType,
                  fileSizeBytes: persisted.sizeBytes,
                  outputHash: result.outputHash,
                  metadata: {
                    storage: "local-file-system",
                    deterministic: true,
                  },
                  readyAt: now,
                  expiresAt: addDays(now, 7),
                },
              });

            successfulFormats.push(format);
          } catch (error) {
            const reason =
              error instanceof Error
                ? error.message
                : "Unknown artifact generation error";
            failedFormats.push({ format, reason });

            if (!isPartialMode) {
              await this.cleanupArtifactsForJob(job.id);
              throw new Error(
                `Strict generation failed for format ${format}: ${reason}`,
              );
            }
          }
        }

        const hasFailures = failedFormats.length > 0;
        const hasSuccesses = successfulFormats.length > 0;

        let finalStatus: "completed" | "partial_failed" | "failed" =
          "completed";
        let errorDetail: string | null = null;

        if (hasFailures && isPartialMode && hasSuccesses) {
          finalStatus = "partial_failed";
          errorDetail = failedFormats
            .map((entry) => `${entry.format}: ${entry.reason}`)
            .join(" | ");
        } else if (hasFailures && (!isPartialMode || !hasSuccesses)) {
          finalStatus = "failed";
          errorDetail = failedFormats
            .map((entry) => `${entry.format}: ${entry.reason}`)
            .join(" | ");

          if (!isPartialMode) {
            await this.cleanupArtifactsForJob(job.id);
          }
        }

        await this.db
          .update(reportJob)
          .set({
            status: finalStatus,
            completedAt: new Date(),
            updatedAt: new Date(),
            errorDetail,
          })
          .where(eq(reportJob.id, job.id));

        await this.db.insert(reportAuditLog).values({
          reportJobId: job.id,
          actorId: params.actorId ?? null,
          actionType: finalStatus === "completed" ? "completed" : finalStatus,
          details: {
            requestedFormats: requestFormats,
            successfulFormats,
            failedFormats,
            generationMode: job.generationMode,
          },
        });

        if (finalStatus === "failed") {
          failed += 1;
        } else {
          completed += 1;
        }
      } catch (error) {
        failed += 1;

        const message =
          error instanceof Error
            ? error.message
            : "Unknown report worker error";

        await this.db
          .update(reportJob)
          .set({
            status: "failed",
            completedAt: new Date(),
            updatedAt: new Date(),
            errorDetail: message,
          })
          .where(eq(reportJob.id, job.id));

        await this.db.insert(reportAuditLog).values({
          reportJobId: job.id,
          actorId: params.actorId ?? null,
          actionType: "failed",
          details: { message },
        });

        logger.error({ err: error, reportJobId: job.id }, "Report job failed");
      }
    }

    return {
      scanned: queued.length,
      completed,
      failed,
    };
  }

  private async cleanupArtifactsForJob(reportJobId: string): Promise<void> {
    const artifacts = await this.db.query.reportArtifact.findMany({
      where: eq(reportArtifact.reportJobId, reportJobId),
      columns: {
        storageKey: true,
      },
    });

    for (const artifact of artifacts) {
      try {
        const absolutePath = resolveArtifactAbsolutePath(artifact.storageKey);
        await unlink(absolutePath);
      } catch {
        // Best-effort file cleanup; DB cleanup below is authoritative.
      }
    }

    await this.db
      .delete(reportArtifact)
      .where(eq(reportArtifact.reportJobId, reportJobId));
  }

  async listJobs(params: {
    actorId: string;
    actorRoles: string[];
    status?:
      | "queued"
      | "processing"
      | "completed"
      | "partial_failed"
      | "failed"
      | "cancelled";
    page: number;
    pageSize: number;
  }): Promise<{ items: Array<typeof reportJob.$inferSelect>; total: number }> {
    const conditions = [];

    if (params.status) conditions.push(eq(reportJob.status, params.status));

    const isPrivileged = params.actorRoles.some((roleValue) =>
      ["admin", "auditor"].includes(roleValue),
    );
    if (!isPrivileged) {
      conditions.push(eq(reportJob.requestedBy, params.actorId));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [items, totalRows] = await Promise.all([
      this.db.query.reportJob.findMany({
        where: whereClause,
        orderBy: [desc(reportJob.createdAt)],
        limit: params.pageSize,
        offset: (params.page - 1) * params.pageSize,
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(reportJob)
        .where(whereClause),
    ]);

    return {
      items,
      total: Number(totalRows[0]?.count ?? 0),
    };
  }

  async getJobWithArtifacts(jobId: string): Promise<{
    job: typeof reportJob.$inferSelect;
    artifacts: Array<typeof reportArtifact.$inferSelect>;
  }> {
    const job = await this.db.query.reportJob.findFirst({
      where: eq(reportJob.id, jobId),
    });

    if (!job) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Report job not found",
      });
    }

    const artifacts = await this.db.query.reportArtifact.findMany({
      where: eq(reportArtifact.reportJobId, jobId),
      orderBy: [asc(reportArtifact.createdAt)],
    });

    return { job, artifacts };
  }

  async resolveDownload(params: {
    actorId: string;
    reportArtifactId: string;
  }): Promise<{ signedUrl: string; expiresAt: Date; contentType: string }> {
    const artifact = await this.db.query.reportArtifact.findFirst({
      where: and(
        eq(reportArtifact.id, params.reportArtifactId),
        eq(reportArtifact.status, "ready"),
      ),
    });

    if (!artifact) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Report artifact is not available",
      });
    }

    if (artifact.expiresAt && artifact.expiresAt < new Date()) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Report artifact has expired",
      });
    }

    await this.db.insert(reportAuditLog).values({
      reportJobId: artifact.reportJobId,
      reportArtifactId: artifact.id,
      actorId: params.actorId,
      actionType: "download_link_issued",
      details: {
        storageKey: artifact.storageKey,
      },
    });

    const expiresAt = addDays(new Date(), 1);

    return {
      signedUrl: `/api/reports/download/${artifact.id}`,
      expiresAt,
      contentType: artifact.contentType,
    };
  }

  private async buildReportData(input: {
    reportType: string;
    scopeType: string;
    scopeDistrictId: string | null;
    scopeFarmId: string | null;
    scopeUserId: string | null;
    timeRangeFrom: Date | null;
    timeRangeTo: Date | null;
  }): Promise<ReportData> {
    const generatedAtIso =
      input.timeRangeTo?.toISOString() ??
      input.timeRangeFrom?.toISOString() ??
      "1970-01-01T00:00:00.000Z";
    const scope = {
      scopeType: input.scopeType as ReportData["scope"]["scopeType"],
      districtId: input.scopeDistrictId ?? undefined,
      farmId: input.scopeFarmId ?? undefined,
      userId: input.scopeUserId ?? undefined,
    };

    if (input.reportType === "user_activity") {
      const conditions: SQL[] = [];

      if (input.timeRangeFrom) {
        conditions.push(gte(auditLog.createdAt, input.timeRangeFrom));
      }
      if (input.timeRangeTo) {
        conditions.push(lte(auditLog.createdAt, input.timeRangeTo));
      }

      if (input.scopeType === "user" && input.scopeUserId) {
        conditions.push(
          or(
            eq(auditLog.entityId, input.scopeUserId),
            eq(auditLog.actorId, input.scopeUserId),
          )!,
        );
      }

      if (input.scopeType === "district" && input.scopeDistrictId) {
        const districtUserIds = await this.resolveDistrictUserIds(
          input.scopeDistrictId,
        );
        if (!districtUserIds.length) {
          return {
            reportType: "user_activity",
            generatedAtIso,
            scope,
            rows: [],
          };
        }
        conditions.push(
          or(
            inArray(auditLog.entityId, districtUserIds),
            inArray(auditLog.actorId, districtUserIds),
          )!,
        );
      }

      if (input.scopeType === "farm" && input.scopeFarmId) {
        const farmUserIds = await this.resolveFarmScopedUserIds(
          input.scopeFarmId,
        );
        if (!farmUserIds.length) {
          return {
            reportType: "user_activity",
            generatedAtIso,
            scope,
            rows: [],
          };
        }
        conditions.push(
          or(
            inArray(auditLog.entityId, farmUserIds),
            inArray(auditLog.actorId, farmUserIds),
          )!,
        );
      }

      const rows = await this.db
        .select({
          createdAt: auditLog.createdAt,
          entityType: auditLog.entityType,
          entityId: auditLog.entityId,
          actorId: auditLog.actorId,
        })
        .from(auditLog)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(auditLog.createdAt));
      return {
        reportType: "user_activity",
        generatedAtIso,
        scope,
        rows,
      };
    }

    if (input.reportType === "district_governance") {
      const conditions: SQL[] = [];

      if (input.timeRangeFrom) {
        conditions.push(gte(userProfile.createdAt, input.timeRangeFrom));
      }
      if (input.timeRangeTo) {
        conditions.push(lte(userProfile.createdAt, input.timeRangeTo));
      }

      if (input.scopeType === "district" && input.scopeDistrictId) {
        conditions.push(eq(userProfile.districtId, input.scopeDistrictId));
      }

      if (input.scopeType === "user" && input.scopeUserId) {
        conditions.push(eq(userProfile.userId, input.scopeUserId));
      }

      if (input.scopeType === "farm" && input.scopeFarmId) {
        const farmUserIds = await this.resolveFarmScopedUserIds(
          input.scopeFarmId,
        );
        if (!farmUserIds.length) {
          return {
            reportType: "district_governance",
            generatedAtIso,
            scope,
            rows: [],
          };
        }
        conditions.push(inArray(userProfile.userId, farmUserIds));
      }

      const rows = await this.db
        .select({
          districtId: userProfile.districtId,
          activeUsers: userProfile.isActive,
        })
        .from(userProfile)
        .where(conditions.length ? and(...conditions) : undefined);
      return {
        reportType: "district_governance",
        generatedAtIso,
        scope,
        rows,
      };
    }

    if (input.reportType === "compliance") {
      const conditions: SQL[] = [
        inArray(auditLog.entityType, [
          "user_role",
          "farm_scope",
          "user_deactivation",
        ]),
      ];

      if (input.timeRangeFrom) {
        conditions.push(gte(auditLog.createdAt, input.timeRangeFrom));
      }
      if (input.timeRangeTo) {
        conditions.push(lte(auditLog.createdAt, input.timeRangeTo));
      }

      if (input.scopeType === "user" && input.scopeUserId) {
        conditions.push(
          or(
            eq(auditLog.entityId, input.scopeUserId),
            eq(auditLog.actorId, input.scopeUserId),
          )!,
        );
      }

      if (input.scopeType === "district" && input.scopeDistrictId) {
        const districtUserIds = await this.resolveDistrictUserIds(
          input.scopeDistrictId,
        );
        if (!districtUserIds.length) {
          return {
            reportType: "compliance",
            generatedAtIso,
            scope,
            rows: [],
          };
        }
        conditions.push(
          or(
            inArray(auditLog.entityId, districtUserIds),
            inArray(auditLog.actorId, districtUserIds),
          )!,
        );
      }

      if (input.scopeType === "farm" && input.scopeFarmId) {
        const farmUserIds = await this.resolveFarmScopedUserIds(
          input.scopeFarmId,
        );
        if (!farmUserIds.length) {
          return {
            reportType: "compliance",
            generatedAtIso,
            scope,
            rows: [],
          };
        }
        conditions.push(
          or(
            inArray(auditLog.entityId, farmUserIds),
            inArray(auditLog.actorId, farmUserIds),
          )!,
        );
      }

      const rows = await this.db
        .select({
          createdAt: auditLog.createdAt,
          action: auditLog.entityType,
          actorId: auditLog.actorId,
          entityId: auditLog.entityId,
        })
        .from(auditLog)
        .where(and(...conditions))
        .orderBy(asc(auditLog.createdAt));
      return {
        reportType: "compliance",
        generatedAtIso,
        scope,
        rows,
      };
    }

    if (input.reportType === "audit_trail") {
      const conditions: SQL[] = [];

      if (input.timeRangeFrom) {
        conditions.push(gte(auditLog.createdAt, input.timeRangeFrom));
      }
      if (input.timeRangeTo) {
        conditions.push(lte(auditLog.createdAt, input.timeRangeTo));
      }

      if (input.scopeType === "user" && input.scopeUserId) {
        conditions.push(
          or(
            eq(auditLog.entityId, input.scopeUserId),
            eq(auditLog.actorId, input.scopeUserId),
          )!,
        );
      }

      if (input.scopeType === "district" && input.scopeDistrictId) {
        const districtUserIds = await this.resolveDistrictUserIds(
          input.scopeDistrictId,
        );
        if (!districtUserIds.length) {
          return {
            reportType: "audit_trail",
            generatedAtIso,
            scope,
            rows: [],
          };
        }
        conditions.push(
          or(
            inArray(auditLog.entityId, districtUserIds),
            inArray(auditLog.actorId, districtUserIds),
          )!,
        );
      }

      if (input.scopeType === "farm" && input.scopeFarmId) {
        const farmUserIds = await this.resolveFarmScopedUserIds(
          input.scopeFarmId,
        );
        if (!farmUserIds.length) {
          return {
            reportType: "audit_trail",
            generatedAtIso,
            scope,
            rows: [],
          };
        }
        conditions.push(
          or(
            inArray(auditLog.entityId, farmUserIds),
            inArray(auditLog.actorId, farmUserIds),
          )!,
        );
      }

      const rows = await this.db
        .select({
          id: auditLog.id,
          createdAt: auditLog.createdAt,
          actorId: auditLog.actorId,
          entityType: auditLog.entityType,
          entityId: auditLog.entityId,
          before: auditLog.before,
          after: auditLog.after,
        })
        .from(auditLog)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(auditLog.createdAt));
      return {
        reportType: "audit_trail",
        generatedAtIso,
        scope,
        rows,
      };
    }

    const userConditions: SQL[] = [];

    if (input.timeRangeFrom) {
      userConditions.push(gte(user.createdAt, input.timeRangeFrom));
    }
    if (input.timeRangeTo) {
      userConditions.push(lte(user.createdAt, input.timeRangeTo));
    }

    if (input.scopeType === "user" && input.scopeUserId) {
      userConditions.push(eq(user.id, input.scopeUserId));
    }

    if (input.scopeType === "district" && input.scopeDistrictId) {
      userConditions.push(eq(userProfile.districtId, input.scopeDistrictId));
    }

    if (input.scopeType === "farm" && input.scopeFarmId) {
      const farmUserIds = await this.resolveFarmScopedUserIds(
        input.scopeFarmId,
      );
      if (!farmUserIds.length) {
        return {
          reportType: "monthly_governance_pack",
          generatedAtIso,
          scope,
          rows: [],
        };
      }
      userConditions.push(inArray(user.id, farmUserIds));
    }

    const rows = await this.db
      .select({
        userId: user.id,
        email: user.email,
        displayUsername: user.displayUsername,
      })
      .from(user)
      .leftJoin(userProfile, eq(userProfile.userId, user.id))
      .where(userConditions.length ? and(...userConditions) : undefined);
    return {
      reportType: "monthly_governance_pack",
      generatedAtIso,
      scope,
      rows,
    };
  }

  private async resolveDistrictUserIds(districtId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: userProfile.userId })
      .from(userProfile)
      .where(eq(userProfile.districtId, districtId));

    return rows.map((row) => row.userId);
  }

  private async resolveFarmScopedUserIds(farmId: string): Promise<string[]> {
    const farmRows = await this.db
      .select({
        ownerId: farm.ownerId,
        farmerUserId: farm.farmerUserId,
      })
      .from(farm)
      .where(eq(farm.id, farmId))
      .limit(1);

    const farmRow = farmRows[0];
    if (!farmRow) {
      return [];
    }

    return [
      ...new Set(
        [farmRow.ownerId, farmRow.farmerUserId].filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        ),
      ),
    ];
  }
}
