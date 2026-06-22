/**
 * POST /api/dashboard/onboarding/complete — marca etapa como concluída (body: stepId).
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { completeOnboardingStepForTenant } from "@/server/dashboard";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const stepId = typeof body.stepId === "string" ? body.stepId.trim() : "";
  if (!stepId) {
    return NextResponse.json({ error: "stepId é obrigatório" }, { status: 400 });
  }

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const result = await completeOnboardingStepForTenant(tenantId, stepId);

      if (!result.ok) {
        if (result.error === "not_found") {
          return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });
        }
        return NextResponse.json({ error: "Etapa já estava concluída" }, { status: 409 });
      }
      return NextResponse.json({ ok: true });
    }, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
