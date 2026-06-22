/**
 * POST /api/dashboard/leads — cria lead manualmente no tenant atual.
 *
 * Body: { name?, email?, phone?, status? }
 * Pelo menos um de name/email/phone é obrigatório.
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { createLeadForTenant } from "@/server/dashboard";

const VALID_STATUSES = new Set([
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
  "duplicate",
  "bad_lead",
]);

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
      const status =
        typeof body.status === "string" && VALID_STATUSES.has(body.status)
          ? (body.status as "new")
          : "new";

      const result = await createLeadForTenant(tenantId, {
        name: typeof body.name === "string" ? body.name : null,
        email: typeof body.email === "string" ? body.email : null,
        phone: typeof body.phone === "string" ? body.phone : null,
        status,
        actorUserId: session.user.id,
      });

      if (!result.ok) {
        if (result.error === "invalid") {
          return NextResponse.json(
            { error: "Informe pelo menos nome, email ou telefone." },
            { status: 400 }
          );
        }
        if (result.error === "conflict") {
          return NextResponse.json(
            { error: "Já existe lead com este e-mail ou telefone." },
            { status: 409 }
          );
        }
      }
      return NextResponse.json({ id: result.ok ? result.id : null }, { status: 201 });
    }, PERMISSION_SLUGS.LEADS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
