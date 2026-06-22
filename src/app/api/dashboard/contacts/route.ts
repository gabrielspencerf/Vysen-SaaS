/**
 * POST /api/dashboard/contacts — cria contato manualmente no tenant atual.
 *
 * Body: { name?, email?, phone?, source? }. Pelo menos um de name/email/phone
 * é obrigatório. source default = "manual".
 *
 * Dedup parcial: contacts.normalized_email/phone tem UNIQUE parcial por
 * tenant — conflito retorna 409.
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { createContactForTenant } from "@/server/dashboard";

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
      const result = await createContactForTenant(tenantId, {
        name: typeof body.name === "string" ? body.name : null,
        email: typeof body.email === "string" ? body.email : null,
        phone: typeof body.phone === "string" ? body.phone : null,
        source: typeof body.source === "string" ? body.source : "manual",
        actorUserId: session.user.id,
      });

      if (!result.ok) {
        if (result.error === "invalid") {
          return NextResponse.json(
            { error: "Informe pelo menos nome, email ou telefone." },
            { status: 400 }
          );
        }
        return NextResponse.json(
          { error: "Já existe contato com este e-mail ou telefone." },
          { status: 409 }
        );
      }
      return NextResponse.json({ id: result.id }, { status: 201 });
    }, PERMISSION_SLUGS.LEADS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
