import "dotenv/config";
import { db } from "./index";
import * as schema from "./schema";
import { auth } from "../better-auth/config";

async function main() {
  console.log("🌱 Starting database seed for testing...");

  // 1. Seed Roles
  console.log("Seeding roles...");
  const roleValues = [
    { type: "admin" as const, displayName: "مدير النظام", description: "Full system access" },
    { type: "district_manager" as const, displayName: "مدير قطاع", description: "District-level access" },
    { type: "farm_owner" as const, displayName: "مالك مزرعة", description: "Farm owner access" },
    { type: "farmer" as const, displayName: "مزارع", description: "Farmer access" },
    { type: "auditor" as const, displayName: "مراقب", description: "Read-only auditor access" },
  ];

  for (const r of roleValues) {
    await db.insert(schema.role).values(r).onConflictDoNothing({ target: schema.role.type });
  }

  // 2. Fetch seeded roles to assign
  const allRoles = await db.query.role.findMany();
  const adminRole = allRoles.find(r => r.type === "admin");
  const farmerRole = allRoles.find(r => r.type === "farmer");

  if (!adminRole || !farmerRole) {
    throw new Error("Roles were not seeded correctly.");
  }

  console.log("Creating test accounts via Better Auth API...");

  const testAccounts = [
    {
      name: "محمد أحمد (مسؤول)",
      username: "12345678901234",
      password: "password123",
      assignedRole: adminRole.id
    },
    {
      name: "عبدالله المزارع",
      username: "98765432109876",
      password: "password123",
      assignedRole: farmerRole.id
    }
  ];

  for (const acc of testAccounts) {
    try {
      // Use internal Better Auth API directly instead of fetch to avoid dev server dependency
      // @ts-ignore
      const result = await auth.api.signUpUsername({
        body: {
            name: acc.name,
            username: acc.username,
            password: acc.password,
        }
      });

      console.log(`Created user ${acc.username}`);

      // 4. Assign the role
      const userRecord = await db.query.user.findFirst({
        where: (users, { eq }) => eq(users.username, acc.username)
      });

      if (userRecord) {
        await db.insert(schema.userRoleAssignment).values({
          userId: userRecord.id,
          roleId: acc.assignedRole,
        }).onConflictDoNothing();
        console.log(`✅ Assigned role to ${acc.name}`);
      }
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.code === "USER_ALREADY_EXISTS") {
         console.log(`User ${acc.username} already exists, checking role assignment...`);
         const userRecord = await db.query.user.findFirst({
            where: (users, { eq }) => eq(users.username, acc.username)
         });
         if (userRecord) {
            await db.insert(schema.userRoleAssignment).values({
              userId: userRecord.id,
              roleId: acc.assignedRole,
            }).onConflictDoNothing();
            console.log(`✅ Role checked/assigned for ${acc.name}`);
         }
      } else {
         console.error(`Error processing ${acc.name}:`, e);
      }
    }
  }

  console.log("✅ Seed completed successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
