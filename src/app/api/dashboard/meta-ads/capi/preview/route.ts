import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { buildMetaCapiPreviewForTenant } from "@/server/dashboard/meta-capi";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 15;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = Number(searchParams.get("limit"));
  const limit = Number.isFinite(parsed)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)))
    : DEFAULT_LIMIT;
  const currencyCode = searchParams.get("currencyCode") ?? undefined;

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const preview = await buildMetaCapiPreviewForTenant(tenantId, {
        limitPerStatus: limit,
        currencyCode,
      });
      return NextResponse.json(preview);
    }, PERMISSION_SLUGS.LEADS_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
