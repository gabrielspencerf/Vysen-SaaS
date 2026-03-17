/**
 * GET /api/dashboard/funnels/default — retorna default_funnel_id do tenant.
 * PATCH /api/dashboard/funnels/default — define funil padrão (body: funnelId ou null).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import {
  getDefaultFunnelIdForTenant,
  setDefaultFunnelIdForTenant,
} from "@/server/dashboard";

export async function GET(request: NextRequest) {
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

  const funnelId = await getDefaultFunnelIdForTenant(tenantId);
  return NextResponse.json({ defaultFunnelId: funnelId });
}

export async function PATCH(request: NextRequest) {
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

  const funnelId =
    body.funnelId === null || body.funnelId === undefined
      ? null
      : typeof body.funnelId === "string"
        ? body.funnelId
        : null;

  const result = await setDefaultFunnelIdForTenant(tenantId, funnelId);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
