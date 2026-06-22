import { NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { listMessagingInstancesForTenant } from "@/server/dashboard/messaging-instances";
import { PERMISSION_SLUGS } from "@/server/rbac";

export async function GET(request: Request) {
  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const instances = await listMessagingInstancesForTenant(tenantId);
      return NextResponse.json({ instances });
    }, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
