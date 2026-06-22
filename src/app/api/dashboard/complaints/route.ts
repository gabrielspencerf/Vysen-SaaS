/**
 * GET /api/dashboard/complaints — lista reclamações do tenant.
 * POST /api/dashboard/complaints — registra reclamação (body: subject?, body).
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import {
  listComplaintsForTenant,
  createComplaintForTenant,
} from "@/server/dashboard";

export async function GET(request: NextRequest) {
  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const list = await listComplaintsForTenant(tenantId);
      return NextResponse.json(list);
    }, PERMISSION_SLUGS.DASHBOARD_READ);
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

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const userId = session.user.id;

      const subject =
        typeof body.subject === "string" ? body.subject : undefined;
      const bodyText = typeof body.body === "string" ? body.body : "";

      const result = await createComplaintForTenant(tenantId, userId, {
        subject,
        body: bodyText,
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, id: result.id });
    }, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
