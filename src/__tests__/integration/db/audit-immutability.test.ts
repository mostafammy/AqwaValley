/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "drizzle",
  "0013_audit_log_append_only.sql",
);

const migrationSql = readFileSync(migrationPath, "utf8");

function expectUpdateDeleteGuardFor(tableName: string, triggerName: string) {
  const pattern = new RegExp(
    `CREATE\\s+TRIGGER\\s+${triggerName}\\s+` +
      `BEFORE\\s+UPDATE\\s+OR\\s+DELETE\\s+ON\\s+"${tableName}"` +
      `\\s+FOR\\s+EACH\\s+ROW\\s+EXECUTE\\s+FUNCTION\\s+` +
      `prevent_append_only_audit_mutation\\(\\)`,
    "i",
  );

  expect(migrationSql).toMatch(pattern);
}

describe("Audit immutability DB integration contract (Invariant #5)", () => {
  it("audit_rejects_update_operations", () => {
    expect(migrationSql).toContain('BEFORE UPDATE OR DELETE ON "audit_log"');
    expect(migrationSql).toContain(
      'BEFORE UPDATE OR DELETE ON "report_audit_log"',
    );
    expect(migrationSql).toContain(
      "audit logs are append-only and cannot be %",
    );
    expect(migrationSql).toContain("TG_OP");
  });

  it("audit_rejects_delete_operations", () => {
    expectUpdateDeleteGuardFor("audit_log", "audit_log_block_mutations");
    expectUpdateDeleteGuardFor(
      "report_audit_log",
      "report_audit_log_block_mutations",
    );
  });

  it("sensitive_mutation_requires_audit_record", () => {
    const deactivationRoutePath = path.resolve(
      process.cwd(),
      "src",
      "server",
      "api",
      "routers",
      "users.ts",
    );
    const roleAssignerPath = path.resolve(
      process.cwd(),
      "src",
      "server",
      "services",
      "user",
      "RoleAssigner.ts",
    );

    const deactivationRoute = readFileSync(deactivationRoutePath, "utf8");
    const roleAssigner = readFileSync(roleAssignerPath, "utf8");

    expect(deactivationRoute).toContain("insert(auditLog)");
    expect(roleAssigner).toContain("insert(auditLog)");
  });
});
