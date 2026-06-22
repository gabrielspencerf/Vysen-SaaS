/**
 * GET /api/dashboard/contacts/[id] — detalhe.
 * PATCH /api/dashboard/contacts/[id] — atualiza name/email/phone.
 * DELETE /api/dashboard/contacts/[id] — remove.
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import {
  deleteContactForTenant,
  getContactByIdForTenant,
  updateContactForTenant,
} from "@/server/dashboard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const row = await getContactByIdForTenant(tenantId, id);
      if (!row) {
        return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
      }
      return NextResponse.json(row);
    }, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
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
      const result = await updateContactForTenant(tenantId, id, {
        name: typeof body.name === "string" ? body.name : undefined,
        email: typeof body.email === "string" ? body.email : undefined,
        phone: typeof body.phone === "string" ? body.phone : undefined,
        actorUserId: session.user.id,
      });
      if (!result.ok) {
        if (result.error === "not_found") {
          return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
        }
        return NextResponse.json(
          { error: "E-mail ou telefone já usado por outro contato." },
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
      const result = await deleteContactForTenant(tenantId, id, session.user.id);
      if (!result.ok) {
        return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }, PERMISSION_SLUGS.LEADS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
