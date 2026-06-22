/**
 * PATCH /api/dashboard/opportunities/[id] — atualiza oportunidade (stage, title, contact_started_at, contracted_model, job_value).
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import {
  updateOpportunityForTenant,
  deleteOpportunityForTenant,
} from "@/server/dashboard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID da oportunidade é obrigatório" }, { status: 400 });
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
      const stage = typeof body.stage === "string" ? body.stage : undefined;
      const title =
        body.title === null || body.title === undefined
          ? undefined
          : typeof body.title === "string" ? body.title : undefined;
      const contactStartedAt =
        body.contactStartedAt === null || body.contactStartedAt === undefined
          ? undefined
          : typeof body.contactStartedAt === "string" ? body.contactStartedAt : undefined;
      const contractedModel =
        body.contractedModel === null || body.contractedModel === undefined
          ? undefined
          : typeof body.contractedModel === "string" ? body.contractedModel : undefined;
      const jobValue =
        body.jobValue === null || body.jobValue === undefined
          ? undefined
          : typeof body.jobValue === "string" ? body.jobValue : undefined;

      const result = await updateOpportunityForTenant(tenantId, id, {
        stage,
        title,
        contactStartedAt,
        contractedModel,
        jobValue,
        actorUserId: session.user.id,
      });

      if (!result.ok) {
        return NextResponse.json({ error: "Oportunidade não encontrada" }, { status: 404 });
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
      const result = await deleteOpportunityForTenant(tenantId, id, session.user.id);
      if (!result.ok) {
        return NextResponse.json({ error: "Oportunidade não encontrada" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }, PERMISSION_SLUGS.LEADS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
