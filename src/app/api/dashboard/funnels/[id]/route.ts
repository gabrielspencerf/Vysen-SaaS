/**
 * GET /api/dashboard/funnels/[id] — funil com etapas.
 * PATCH /api/dashboard/funnels/[id] — atualiza funil (body: name?, description?, isActive?).
 * DELETE /api/dashboard/funnels/[id] — remove funil e etapas.
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import {
  getFunnelWithStepsForTenant,
  updateFunnelForTenant,
  deleteFunnelForTenant,
} from "@/server/dashboard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: funnelId } = await params;
  if (!funnelId) {
    return NextResponse.json({ error: "ID do funil é obrigatório" }, { status: 400 });
  }

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const funnel = await getFunnelWithStepsForTenant(tenantId, funnelId);
      if (!funnel) {
        return NextResponse.json({ error: "Funil não encontrado" }, { status: 404 });
      }
      return NextResponse.json(funnel);
    }, PERMISSION_SLUGS.FUNNELS_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: funnelId } = await params;
  if (!funnelId) {
    return NextResponse.json({ error: "ID do funil é obrigatório" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const name = typeof body.name === "string" ? body.name : undefined;
      const description =
        body.description !== undefined ? body.description : undefined;
      const isActive =
        body.isActive === true || body.isActive === false ? body.isActive : undefined;

      const result = await updateFunnelForTenant(tenantId, funnelId, {
        name,
        description: description !== undefined ? (description as string | null) : undefined,
        isActive,
      });

      if ("error" in result) {
        return NextResponse.json(
          { error: result.error },
          { status: result.error === "Funil não encontrado" ? 404 : 400 }
        );
      }
      return NextResponse.json({ ok: true });
    }, PERMISSION_SLUGS.FUNNELS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: funnelId } = await params;
  if (!funnelId) {
    return NextResponse.json({ error: "ID do funil é obrigatório" }, { status: 400 });
  }

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const result = await deleteFunnelForTenant(tenantId, funnelId);
      if ("error" in result) {
        return NextResponse.json(
          { error: result.error },
          { status: result.error === "Funil não encontrado" ? 404 : 400 }
        );
      }
      return NextResponse.json({ ok: true });
    }, PERMISSION_SLUGS.FUNNELS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
