import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "~/server/better-auth";
import { db } from "~/server/db";
import { sensors, userRoleAssignment, role } from "~/server/db/schema";
import { and, eq } from "drizzle-orm";
import { ingestReadings } from "~/server/services/ingestService";
import { type ApiKeyContext } from "~/lib/apiKeyAuth";

const sensorTypeValues = [
  "water_level",
  "pressure",
  "flow_rate",
  "temperature",
  "humidity",
] as const;

const bodySchema = z.object({
  wellId: z.string().uuid(),
  sensorType: z.enum(sensorTypeValues),
  value: z.number().finite(),
  timestamp: z
    .string()
    .datetime({ offset: true })
    .transform((s) => new Date(s))
    .optional()
    .default(() => new Date().toISOString()),
});

async function isAdmin(userId: string): Promise<boolean> {
  const [record] = await db
    .select({ type: role.type })
    .from(userRoleAssignment)
    .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
    .where(eq(userRoleAssignment.userId, userId))
    .limit(1);

  return (
    record?.type === "admin" ||
    (await db
      .select({ type: role.type })
      .from(userRoleAssignment)
      .innerJoin(role, eq(userRoleAssignment.roleId, role.id))
      .where(eq(userRoleAssignment.userId, userId))
      .then((rows) => rows.some((r) => r.type === "admin")))
  );
}

export async function POST(request: NextRequest) {
  // Admin session required
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminCheck = await isAdmin(session.user.id);
  if (!adminCheck) {
    return NextResponse.json(
      { error: "Forbidden: admin only" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { wellId, sensorType, value, timestamp } = parsed.data;

  // Find a sensor of the given type for this well
  const [sensor] = await db
    .select({ id: sensors.id })
    .from(sensors)
    .where(and(eq(sensors.wellId, wellId), eq(sensors.type, sensorType)))
    .limit(1);

  if (!sensor) {
    return NextResponse.json(
      { error: `No sensor of type '${sensorType}' found for well ${wellId}` },
      { status: 404 },
    );
  }

  // Create a mock ApiKeyContext scoped to this well
  const mockCtx: ApiKeyContext = {
    id: "admin-mock",
    name: "admin-mock-ingest",
    wellId,
  };

  const result = await ingestReadings(mockCtx, [
    { sensorId: sensor.id, value, timestamp },
  ]);

  return NextResponse.json(result);
}
