/**
 * PATCH /api/dashboard/funnels/[id]/steps/[stepId] — atualiza etapa (body: name?).
 * DELETE /api/dashboard/funnels/[id]/steps/[stepId] — remove etapa.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import {
  updateFunnelStepForTenant,
  deleteFunnelStepForTenant,
} from "@/server/dashboard";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
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

  const { id: funnelId, stepId } = await params;
  if (!funnelId || !stepId) {
    return NextResponse.json(
      { error: "ID do funil e da etapa são obrigatórios" },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : undefined;

  const result = await updateFunnelStepForTenant(
    tenantId,
    funnelId,
    stepId,
    { name }
  );
  if ("error" in result) {
    const status =
      result.error === "Funil não encontrado" || result.error === "Etapa não encontrada"
        ? 404
        : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
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

  const { id: funnelId, stepId } = await params;
  if (!funnelId || !stepId) {
    return NextResponse.json(
      { error: "ID do funil e da etapa são obrigatórios" },
      { status: 400 }
    );
  }

  const result = await deleteFunnelStepForTenant(tenantId, funnelId, stepId);
  if ("error" in result) {
    const status =
      result.error === "Funil não encontrado" || result.error === "Etapa não encontrada"
        ? 404
        : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
