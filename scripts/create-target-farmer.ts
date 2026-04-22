import { existsSync, readFileSync } from "fs";

/**
 * Basic environment loader to satisfy T3 Env validation.
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
  const { db } = await import("../src/server/db");
  const schema = await import("../src/server/db/schema");
  const { auth } = await import("../src/server/better-auth/config");
  const { eq } = await import("drizzle-orm");

  const targetNationalId = "29801010100405";
  const name = "Farmer 00405";
  const email = `farmer.${targetNationalId}@aqwavalley.local`;
  const password = "password123";

  console.log(`🚀 Creating farmer with National ID: ${targetNationalId}`);

  // 1. Get Farmer Role
  const [farmerRole] = await db
    .select()
    .from(schema.role)
    .where(eq(schema.role.type, "farmer"))
    .limit(1);

  if (!farmerRole) {
    throw new Error("Farmer role not found in database. Please run pnpm db:seed first.");
  }

  // 2. Create User via Auth API
  try {
    const authApi = auth.api as any;
    const signUp = authApi.signUpUsername ?? authApi.signUp?.username ?? authApi.signUpEmail;

    if (!signUp) throw new Error("No sign-up method found on auth.api");

    await signUp({
      body: {
        name,
        username: targetNationalId,
        email,
        password,
      },
    });
    console.log("✅ User created in auth system.");
  } catch (error: any) {
    console.log("ℹ️ User creation status:", error.message);
  }

  // 3. Find created user to get ID
  const user = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.username, targetNationalId),
  });

  if (!user) {
    throw new Error("Failed to find or create user.");
  }

  // 4. Update/Create Profile
  await db
    .insert(schema.userProfile)
    .values({
      userId: user.id,
      nationalId: targetNationalId,
      fullName: name,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: schema.userProfile.nationalId,
      set: { userId: user.id, fullName: name, isActive: true },
    });
  console.log("✅ User profile updated.");

  // 5. Assign Role
  await db
    .insert(schema.userRoleAssignment)
    .values({
      userId: user.id,
      roleId: farmerRole.id,
    })
    .onConflictDoNothing();
  console.log("✅ Farmer role assigned.");

  console.log(`✨ Success! Farmer ${targetNationalId} is ready.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
