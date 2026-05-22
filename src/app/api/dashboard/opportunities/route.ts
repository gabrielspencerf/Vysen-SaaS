/**
 * POST /api/dashboard/opportunities — cria nova oportunidade no tenant atual.
 *
 * Body opcional: { stage, title, contact_started_at, contracted_model,
 *                  job_value, lead_id, contact_id, conversation_id }
 *
 * Stage default = "open" (enum opportunity_stage_enum).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { createOpportunityForTenant } from "@/server/dashboard";

const VALID_STAGES = new Set([
  "open",
  "qualified",
  "negotiating",
  "won",
  "lost",
]);

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireDashboardApiAuth(request, PERMISSION_SLUGS.LEADS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }

  const tenantId = session.session.currentTenantId!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const stage = typeof body.stage === "string" ? body.stage.trim() : "open";
  if (!VALID_STAGES.has(stage)) {
    return NextResponse.json(
      { error: "Stage inválido. Use: open | qualified | negotiating | won | lost." },
      { status: 400 }
    );
  }

  const result = await createOpportunityForTenant(tenantId, {
    stage,
    title:
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 255)
        : null,
    contactStartedAt:
      typeof body.contact_started_at === "string"
        ? body.contact_started_at
        : null,
    contractedModel:
      typeof body.contracted_model === "string" && body.contracted_model.trim()
        ? body.contracted_model.trim().slice(0, 128)
        : null,
    jobValue:
      typeof body.job_value === "string" || typeof body.job_value === "number"
        ? String(body.job_value)
        : null,
    leadId: typeof body.lead_id === "string" ? body.lead_id : null,
    contactId: typeof body.contact_id === "string" ? body.contact_id : null,
    conversationId:
      typeof body.conversation_id === "string" ? body.conversation_id : null,
    actorUserId: session.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ id: result.id }, { status: 201 });
}
