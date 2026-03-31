import * as Sentry from "@sentry/nextjs";
export const dynamic = "force-dynamic";

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

// A guarded API route to test Sentry's error monitoring in controlled contexts.
// Allowed when:
// - NODE_ENV === 'development', OR
// - ALLOW_SENTRY_EXAMPLE === 'true', OR
// - a valid admin token is supplied via the `x-admin-token` header and matches
//   the `SENTRY_EXAMPLE_ADMIN_TOKEN` env var.
export async function GET(request: Request) {
  const envAllow =
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_SENTRY_EXAMPLE === "true";
  const adminToken = process.env.SENTRY_EXAMPLE_ADMIN_TOKEN;
  const headerToken =
    request.headers.get("x-admin-token") ??
    request.headers.get("X-Admin-Token") ??
    undefined;
  const tokenAllow = Boolean(
    adminToken && headerToken && adminToken === headerToken,
  );
  const allowed = envAllow || tokenAllow;

  if (!allowed) {
    // Hide the existence of this endpoint in production/unallowed contexts.
    return new Response(null, { status: 404 });
  }

  // Allowed: log and raise an error to exercise Sentry in a safe context.
  Sentry.logger.info("Sentry example API called (allowed)");
  throw new SentryExampleAPIError(
    "This error is raised on the backend called by the example page.",
  );
}
