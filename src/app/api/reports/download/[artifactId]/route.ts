import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { access } from "fs/promises";
import { Readable } from "stream";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { auth } from "~/server/better-auth";
import { db } from "~/server/db";
import {
  reportArtifact,
  reportJob,
  role,
  userRoleAssignment,
} from "~/server/db/schema";
import { ReportAccessPolicy } from "~/server/services/reporting/ReportAccessPolicy";
import { resolveArtifactAbsolutePath } from "~/server/services/reporting/storage";

export const runtime = "nodejs";

type Params = { artifactId: string };
const artifactIdSchema = z.string().uuid();

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> },
): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const resolved = await params;
  const artifactId = resolved.artifactId;

  if (!artifactIdSchema.safeParse(artifactId).success) {
    return NextResponse.json({ error: "ARTIFACT_NOT_FOUND" }, { status: 404 });
  }

  const artifact = await db.query.reportArtifact.findFirst({
    where: and(
      eq(reportArtifact.id, artifactId),
      eq(reportArtifact.status, "ready"),
    ),
  });

  if (!artifact) {
    return NextResponse.json({ error: "ARTIFACT_NOT_FOUND" }, { status: 404 });
  }

  if (artifact.expiresAt && artifact.expiresAt < new Date()) {
    return NextResponse.json({ error: "ARTIFACT_EXPIRED" }, { status: 404 });
  }

  const job = await db.query.reportJob.findFirst({
    where: eq(reportJob.id, artifact.reportJobId),
    columns: { requestedBy: true },
  });

  if (!job) {
    return NextResponse.json(
      { error: "REPORT_JOB_NOT_FOUND" },
      { status: 404 },
    );
  }

  const assignments = await db
    .select({ type: role.type })
    .from(userRoleAssignment)
    .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
    .where(eq(userRoleAssignment.userId, session.user.id));

  const policy = new ReportAccessPolicy();
  try {
    policy.assertCanViewJob({
      actorId: session.user.id,
      actorRoles: assignments.map((assignment) => assignment.type),
      requestedBy: job.requestedBy,
    });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    throw error;
  }

  const sizeBytes = artifact.fileSizeBytes;
  const absolutePath = resolveArtifactAbsolutePath(artifact.storageKey);
  try {
    await access(absolutePath);
  } catch {
    return NextResponse.json(
      { error: "ARTIFACT_STORAGE_MISSING" },
      { status: 404 },
    );
  }

  const nodeStream = createReadStream(absolutePath);
  nodeStream.once("error", () => {
    if (!nodeStream.destroyed) {
      nodeStream.destroy();
    }
  });

  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  const filename = `${artifact.id}.${artifact.format}`;

  return new Response(webStream, {
    status: 200,
    headers: {
      "content-type": artifact.contentType,
      "content-length": String(sizeBytes),
      "content-disposition": `attachment; filename=\"${filename}\"`,
      "cache-control": "private, no-store",
    },
  });
}
