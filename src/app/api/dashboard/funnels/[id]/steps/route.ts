/**
 * POST /api/dashboard/funnels/[id]/steps — adiciona etapa ao funil (body: name).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { createFunnelStepForTenant } from "@/server/dashboard";

export async function POST(
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

  const { id: funnelId } = await params;
  if (!funnelId) {
    return NextResponse.json(
      { error: "ID do funil é obrigatório" },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "Nome da etapa é obrigatório" },
      { status: 400 }
    );
  }

  const result = await createFunnelStepForTenant(tenantId, funnelId, { name });
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "Funil não encontrado" ? 404 : 400 }
    );
  }
  return NextResponse.json({ ok: true, id: result.id });
}
