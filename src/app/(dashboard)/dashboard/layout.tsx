import { getDashboardTenantContext } from "@/server/dashboard";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSidebarInsightsForTenant } from "@/server/sidebar/insights";
import { getDb } from "@/server/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function DashboardMainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, tenantId, showAdminLink } =
    await getDashboardTenantContext();
  const insights = await getSidebarInsightsForTenant(tenantId, { periodDays: 30 });
  const db = getDb();
  const [profile] = await db
    .select({ avatarUrl: userProfiles.avatarUrl })
    .from(userProfiles)
    .where(eq(userProfiles.userId, session.user.id))
    .limit(1);
  return (
    <DashboardShell
      tenantId={tenantId}
      userEmail={session.user.email}
      userName={session.user.name}
      userAvatarUrl={profile?.avatarUrl ?? null}
      showAdminLink={showAdminLink}
      insights={insights}
    >
      {children}
    </DashboardShell>
  );
}
