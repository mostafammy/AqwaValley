import { redirect } from "next/navigation";
import { or, eq } from "drizzle-orm";
import { Topbar } from "../_components/layouts/Topbar";
import { FarmSidebar } from "../_components/layouts/FarmSidebar";
import { SidebarProvider } from "../_components/layouts/SidebarProvider";
import { getSession } from "~/server/better-auth/server";
import { getUserRolePath } from "~/app/_actions/auth";
import { ScrollReset } from "~/app/_components/layouts/ScrollReset";
import { db } from "~/server/db";
import { farm } from "~/server/db/schema";
import { api } from "~/trpc/server";

/**
 * Render the farm portal layout for authenticated users with the farmer role.
 *
 * If the session is missing or the user's role path is not "/farm/dashboard", this component redirects to the root path ("/").
 *
 * @param children - Content to render inside the layout's main area.
 * @returns A React element containing the sidebar, topbar (populated from session data), and a main content area that wraps `children`.
 */
export default async function FarmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Validate session is present
  const session = await getSession();
  if (!session?.user) redirect("/");

  // Validate user has Farm portal privileges
  const rolePath = await getUserRolePath();
  if (rolePath !== "/farm/dashboard") redirect("/");

  // Prepare UI variables from session
  const name = session.user.name ?? "مزارع";
  const parts = name.trim().split(" ");
  const initials =
    parts.length > 1
      ? `${parts[0]?.[0] ?? ""}.${parts[parts.length - 1]?.[0] ?? ""}`
      : (name[0] ?? "F");

  // Resolve farm for weather coordinates
  const farmRows = await db
    .select({ id: farm.id, name: farm.name })
    .from(farm)
    .where(
      or(
        eq(farm.farmerUserId, session.user.id),
        eq(farm.ownerId, session.user.id),
      ),
    )
    .limit(1);

  const currentFarm = farmRows[0];

  // Fetch live weather based on farm's well coordinates
  let weatherChip = "—";
  try {
    const weather = await api.weather.getCurrent({
      farmId: currentFarm?.id,
    });
    weatherChip = weather.formatted;
  } catch {
    weatherChip = "الطقس غير متاح";
  }

  return (
    <SidebarProvider>
      <div className="layout-root">
        <ScrollReset />
        <Topbar
          userName={name}
          userRole="FARMER"
          userInitials={initials}
          portalLabel={currentFarm?.name ?? "مزرعتي"}
          weatherChip={weatherChip}
        />
        <div className="layout-content-row">
          <FarmSidebar />
          <main className="layout-main">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
