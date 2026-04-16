import { NextRequest, NextResponse } from "next/server";
import { requireDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { getTenantFeatureFlags } from "@/server/tenancy/tenant-features";
import { listAuditLogsForTenant } from "@/server/audit/log";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireDashboardApiAuth(request, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }

  const tenantId = session.session.currentTenantId!;
  const flags = await getTenantFeatureFlags(tenantId);
  if (!flags.auditEnabled) {
    return NextResponse.json({
      enabled: false,
      scopes: [],
      logs: [],
    });
  }

  const logs = await listAuditLogsForTenant({ tenantId, limit: 100 });
  return NextResponse.json({
    enabled: true,
    scopes: flags.auditScopes,
    logs: logs.map((row) => ({
      id: row.id,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      occurredAt: row.occurredAt.toISOString(),
      userId: row.userId,
      oldValues: row.oldValues,
      newValues: row.newValues,
    })),
  });
}

