/**
 * GET /api/dashboard/funnels — lista funis do tenant.
 * POST /api/dashboard/funnels — cria funil (body: name, description?, isActive?).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import {
  listFunnelsForTenant,
  createFunnelForTenant,
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

  const list = await listFunnelsForTenant(tenantId);
  return NextResponse.json(list);
}

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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    body.description !== undefined && body.description !== null
      ? String(body.description)
      : undefined;
  const isActive = body.isActive === false ? false : true;

  const result = await createFunnelForTenant(tenantId, {
    name,
    description: description ?? null,
    isActive,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, id: result.id });
}
