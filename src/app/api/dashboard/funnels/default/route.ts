/**
 * GET /api/dashboard/funnels/default — retorna default_funnel_id do tenant.
 * PATCH /api/dashboard/funnels/default — define funil padrão (body: funnelId ou null).
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import {
  getDefaultFunnelIdForTenant,
  setDefaultFunnelIdForTenant,
} from "@/server/dashboard";

export async function GET(request: NextRequest) {
  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const funnelId = await getDefaultFunnelIdForTenant(tenantId);
      return NextResponse.json({ defaultFunnelId: funnelId });
    }, PERMISSION_SLUGS.FUNNELS_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const funnelId =
        body.funnelId === null || body.funnelId === undefined
          ? null
          : typeof body.funnelId === "string"
            ? body.funnelId
            : null;

      const result = await setDefaultFunnelIdForTenant(tenantId, funnelId);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }, PERMISSION_SLUGS.FUNNELS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
