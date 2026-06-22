/**
 * GET /api/dashboard/funnels — lista funis do tenant.
 * POST /api/dashboard/funnels — cria funil (body: name, description?, isActive?).
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import {
  listFunnelsForTenant,
  createFunnelForTenant,
} from "@/server/dashboard";

export async function GET(request: NextRequest) {
  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const list = await listFunnelsForTenant(tenantId);
      return NextResponse.json(list);
    }, PERMISSION_SLUGS.FUNNELS_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    body.description !== undefined && body.description !== null
      ? String(body.description)
      : undefined;
  const isActive = body.isActive === false ? false : true;

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const result = await createFunnelForTenant(tenantId, {
        name,
        description: description ?? null,
        isActive,
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, id: result.id });
    }, PERMISSION_SLUGS.FUNNELS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
