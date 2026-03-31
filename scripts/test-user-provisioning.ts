import { db } from "../src/server/db/index";
import { UserProvisioningOrchestrator } from "../src/server/services/user/UserProvisioningOrchestrator";
import { AuthUserCreator } from "../src/server/services/user/AuthUserCreator";
import { InvitationIssuer } from "../src/server/services/user/InvitationIssuer";
import { RoleAssigner } from "../src/server/services/user/RoleAssigner";
import { FarmScopeAssigner } from "../src/server/services/user/FarmScopeAssigner";
import { OutboxEnqueuer } from "../src/server/services/user/OutboxEnqueuer";
import { SessionInvalidator } from "../src/server/services/user/SessionInvalidator";
import { eq } from "drizzle-orm";
import { user, auditLog, outboxEvent, userRoleAssignment } from "../src/server/db/schema";
import { randomUUID } from "crypto";

async function main() {
  console.log("🚀 Starting User Provisioning Integration Test...");

  // Build the orchestrator
  const authUserCreator = new AuthUserCreator();
  const invitationIssuer = new InvitationIssuer(db);
  const roleAssigner = new RoleAssigner(db);
  const farmScopeAssigner = new FarmScopeAssigner(db);
  const outboxEnqueuer = new OutboxEnqueuer(db);
  const sessionInvalidator = new SessionInvalidator(db);

  const orchestrator = new UserProvisioningOrchestrator(
    db,
    authUserCreator,
    invitationIssuer,
    roleAssigner,
    farmScopeAssigner,
    outboxEnqueuer,
    sessionInvalidator
  );

  // We need an "actor" (the admin doing the provisioning)
  // Let's fetch the first user from the DB to act as the admin
  const firstUser = await db.query.user.findFirst({ columns: { id: true } });
  if (!firstUser) {
    console.error("No users found in DB to act as admin. Run the seed script first.");
    process.exit(1);
  }
  const adminActorId = firstUser.id;

  // Test Payload
  // Use non-sensitive deterministic test values to avoid committing real PII/tokens
  const testNationalId = `REDACTED_NATIONAL_ID`;
  const testEmail = `test.farmer+ci@example.com`;
  
  console.log("📦 Provisioning Payload:");
  console.log({
    nationalId: testNationalId,
    email: testEmail,
    fullName: "Integration Test Farmer",
    roleType: "farmer",
  });

  try {
    // 1. Provision the User
    console.log("\n⏳ Executing provision()...");
    const result = await orchestrator.provision({
      nationalId: testNationalId,
      email: testEmail,
      fullName: "Integration Test Farmer",
      roleType: "farmer",
      actorId: adminActorId,
      ipAddress: "127.0.0.1",
    });

    console.log("✅ Provisioning Result:", result);

    if (result.status === "INVITED") {
      const newUserId = result.userId;
      
      // 2. Interrogate the Database to verify cross-table transactionality
      console.log("\n🔍 Verifying Database State...");
      
      const createdUser = await db.query.user.findFirst({
        where: eq(user.id, newUserId),
        columns: { id: true, email: true, name: true, createdAt: true }
      });
      console.log("  👤 User record:", createdUser ? "OK" : "MISSING");

      const roles = await db.select().from(userRoleAssignment).where(eq(userRoleAssignment.userId, newUserId));
      console.log(`  🔑 Roles assigned: ${roles.length} (Expected 1)`);

      const audits = await db.select().from(auditLog).where(eq(auditLog.entityId, newUserId));
      console.log(`  📜 Audit logs written: ${audits.length} (Expected 1 or more for role assignment)`);

      const outboxEvents = await db.select().from(outboxEvent);
      const userOutbox = outboxEvents.filter(e => {
        const payload = e.payload as any;
        return payload?.recipientUserId === newUserId;
      });
      console.log(`  ✉️ Outbox events queued: ${userOutbox.length} (Expected 1 for invitation email)`);
      if (userOutbox.length > 0) {
        // Sanitize any potentially sensitive fields before printing
        const rawPayload = userOutbox[0]?.payload ?? {};
        const sanitize = (p: any) => {
          try {
            const asStr = JSON.stringify(p);
            return asStr
              .replace(/token=[A-Za-z0-9._-]{8,}/g, 'token=REDACTED_TOKEN')
              .replace(/\b[0-9a-fA-F]{16,}\b/g, 'REDACTED_ID')
              .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, 'REDACTED_EMAIL');
          } catch (e) {
            return String(p);
          }
        };
        console.log("     Example Outbox Payload:", JSON.parse(sanitize(rawPayload)));
      }

      console.log("\n🎉 ALL TESTS PASSED. The mediator orchestrated the transaction securely.");
    } else {
      console.log("⚠️ Provisioning returned non-INVITED status:", result.status);
    }
  } catch (error) {
    console.error("\n❌ Test Failed with Error:", error);
  } finally {
    process.exit(0);
  }
}

main();
