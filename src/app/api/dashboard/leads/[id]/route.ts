/**
 * PATCH /api/dashboard/leads/[id] — atualiza dados editáveis do lead (tenant da sessão).
 * Body: { name?, email?, phone?, status? }
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { updateLeadForTenant, deleteLeadForTenant } from "@/server/dashboard";

const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
  "duplicate",
  "bad_lead",
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;
  if (!leadId) {
    return NextResponse.json({ error: "ID do lead é obrigatório" }, { status: 400 });
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
      const name =
        body.name === null || body.name === undefined
          ? undefined
          : typeof body.name === "string" ? body.name : undefined;
      const email =
        body.email === null || body.email === undefined
          ? undefined
          : typeof body.email === "string" ? body.email : undefined;
      const phone =
        body.phone === null || body.phone === undefined
          ? undefined
          : typeof body.phone === "string" ? body.phone : undefined;
      const statusRaw =
        body.status === null || body.status === undefined
          ? undefined
          : typeof body.status === "string" ? body.status : undefined;
      const status =
        statusRaw && LEAD_STATUSES.includes(statusRaw as (typeof LEAD_STATUSES)[number])
          ? (statusRaw as (typeof LEAD_STATUSES)[number])
          : undefined;

      const result = await updateLeadForTenant(tenantId, leadId, {
        name,
        email,
        phone,
        status,
        actorUserId: session.user.id,
      });

      if (!result.ok) {
        if (result.error === "not_found") {
          return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
        }
        return NextResponse.json(
          { error: "Conflito: e-mail ou telefone já usado por outro lead" },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: true });
    }, PERMISSION_SLUGS.LEADS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  }
  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const result = await deleteLeadForTenant(tenantId, id, session.user.id);
      if (!result.ok) {
        return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }, PERMISSION_SLUGS.LEADS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
