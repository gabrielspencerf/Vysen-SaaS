/**
 * GET /api/dashboard/pagespeed/results — lista resultados por data e dispositivo.
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { listPageSpeedResultsForTenant } from "@/server/dashboard";

export async function GET(request: NextRequest) {
  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const list = await listPageSpeedResultsForTenant(tenantId, { limit: 60 });
      const serialized = list.map((r) => ({
        ...r,
        metricDate:
          typeof r.metricDate === "string"
            ? r.metricDate.slice(0, 10)
            : new Date(r.metricDate).toISOString().slice(0, 10),
        fetchedAt:
          typeof r.fetchedAt === "string"
            ? r.fetchedAt
            : new Date(r.fetchedAt).toISOString(),
      }));
      return NextResponse.json(serialized);
    }, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
