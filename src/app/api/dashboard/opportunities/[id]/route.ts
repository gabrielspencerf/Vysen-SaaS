/**
 * PATCH /api/dashboard/opportunities/[id] — atualiza oportunidade (stage, title, contact_started_at, contracted_model, job_value).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { updateOpportunityForTenant } from "@/server/dashboard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAuth(request);
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: e.status ?? 401 }
    );
  }

  const tenantId = session.session.currentTenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant não selecionado" },
      { status: 400 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "ID da oportunidade é obrigatório" },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const stage = typeof body.stage === "string" ? body.stage : undefined;
  const title =
    body.title === null || body.title === undefined
      ? undefined
      : typeof body.title === "string"
        ? body.title
        : undefined;
  const contactStartedAt =
    body.contactStartedAt === null || body.contactStartedAt === undefined
      ? undefined
      : typeof body.contactStartedAt === "string"
        ? body.contactStartedAt
        : undefined;
  const contractedModel =
    body.contractedModel === null || body.contractedModel === undefined
      ? undefined
      : typeof body.contractedModel === "string"
        ? body.contractedModel
        : undefined;
  const jobValue =
    body.jobValue === null || body.jobValue === undefined
      ? undefined
      : typeof body.jobValue === "string"
        ? body.jobValue
        : undefined;

  const result = await updateOpportunityForTenant(tenantId, id, {
    stage,
    title,
    contactStartedAt,
    contractedModel,
    jobValue,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Oportunidade não encontrada" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
