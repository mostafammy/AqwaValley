import { existsSync, readFileSync } from "fs";

/**
 * Basic environment loader to avoid 'dotenv' dependency
 * Must run before any other project imports to satisfy T3 Env validation.
 */
function loadLocalEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const rawValue = trimmed.slice(idx + 1).trim();
      const value = rawValue.replace(/^['\"]|['\"]$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadLocalEnv();

async function main() {
  // Dynamic imports to ensure loadLocalEnv() has finished and populated process.env
  const { db } = await import("./index");
  const schema = await import("./schema");
  const { auth } = await import("../better-auth/config");
  const { eq, inArray } = await import("drizzle-orm");

  type SignUpFn = (args: {
    body: {
      name: string;
      username: string;
      email: string;
      password: string;
    };
  }) => Promise<unknown>;

  console.log("🌱 Restoring test accounts...");

  const testUsernames = ["12345678901234", "98765432109876"];

  console.log("🗑️ Cleaning up old test accounts for a fresh start...");
  await db
    .delete(schema.user)
    .where(inArray(schema.user.username, testUsernames));

  // 1. Ensure essential roles exist
  const roleValues = [
    {
      type: "admin" as const,
      displayName: "مدير النظام",
      description: "Full system access",
    },
    {
      type: "farmer" as const,
      displayName: "مزارع",
      description: "Farmer access",
    },
  ];

  for (const r of roleValues) {
    await db
      .insert(schema.role)
      .values(r)
      .onConflictDoNothing({ target: schema.role.type });
  }

  const allRoles = await db.query.role.findMany();
  const adminRole = allRoles.find((r) => r.type === "admin");
  const farmerRole = allRoles.find((r) => r.type === "farmer");

  if (!adminRole || !farmerRole) throw new Error("Roles missing");

  const testAccounts = [
    { name: "Admin User", username: "12345678901234", roleId: adminRole.id },
    { name: "Farmer User", username: "98765432109876", roleId: farmerRole.id },
  ];

  for (const acc of testAccounts) {
    try {
      const authApi = auth.api as {
        signUpUsername?: SignUpFn;
        signUp?: { username?: SignUpFn };
        signUpEmail?: SignUpFn;
      };

      const signUp =
        authApi.signUpUsername ??
        authApi.signUp?.username ??
        authApi.signUpEmail;

      if (!signUp)
        throw new Error(
          "No sign-up method (signUpUsername or signUpEmail) found on auth.api",
        );

      const email = `test_${acc.username}@local.test`;

      await signUp({
        body: {
          name: acc.name,
          username: acc.username, // signUpUsername/signUp.username uses this
          email: email, // signUpEmail uses this
          password: "password123",
        },
      });
      console.log(`✅ Created ${acc.username}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Ready or handled";
      console.log(`ℹ️ ${acc.username} status:`, message);
    }

    // Manual Fix: Ensure the username and profile are correctly set up regardless of which API we used
    const userRec = await db.query.user.findFirst({
      where: (u, { or, eq }) =>
        or(
          eq(u.username, acc.username),
          eq(u.email, `test_${acc.username}@local.test`),
        ),
    });

    if (userRec) {
      // Ensure the Better Auth user has the correct username
      await db
        .update(schema.user)
        .set({ username: acc.username, displayUsername: acc.username })
        .where(eq(schema.user.id, userRec.id));

      // Create the user profile (operational side)
      await db
        .insert(schema.userProfile)
        .values({
          userId: userRec.id,
          nationalId: acc.username,
          fullName: acc.name,
          isActive: true,
        })
        .onConflictDoNothing();

      // Assign Role
      await db
        .insert(schema.userRoleAssignment)
        .values({
          userId: userRec.id,
          roleId: acc.roleId,
        })
        .onConflictDoNothing();
    }
  }

  console.log("✨ Done! You can now log in with 12345678901234 / password123");
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
