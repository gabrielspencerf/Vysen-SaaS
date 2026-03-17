/**
 * POST /api/dashboard/onboarding/complete — marca etapa como concluída (body: stepId).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { completeOnboardingStepForTenant } from "@/server/dashboard";

export async function POST(request: NextRequest) {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const stepId = typeof body.stepId === "string" ? body.stepId.trim() : "";
  if (!stepId) {
    return NextResponse.json(
      { error: "stepId é obrigatório" },
      { status: 400 }
    );
  }

  const result = await completeOnboardingStepForTenant(tenantId, stepId);

  if (!result.ok) {
    if (result.error === "not_found") {
      return NextResponse.json(
        { error: "Etapa não encontrada" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Etapa já estava concluída" },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
