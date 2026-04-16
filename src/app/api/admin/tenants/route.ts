/**
 * GET /api/admin/tenants — listar tenants (super_admin).
 * POST /api/admin/tenants — criar tenant (super_admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin/require-admin";
import { listTenants, createTenant } from "@/server/admin/tenants";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json(
      { error: e.status === 403 ? "Sem permissão" : "Não autenticado" },
      { status: e.status ?? 401 }
    );
  }
  const tenants = await listTenants();
  return NextResponse.json({
    tenants: tenants.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
  });
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdmin(request);
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json(
      { error: e.status === 403 ? "Sem permissão" : "Não autenticado" },
      { status: e.status ?? 401 }
    );
  }

  let body: {
    name?: string;
    slug?: string;
    settings?: Record<string, unknown> | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo inválido" },
      { status: 400 }
    );
  }

  const result = await createTenant({
    name: body.name ?? "",
    slug: body.slug ?? "",
    settings: body.settings,
  });

  if ("error" in result) {
    const status = result.error.includes("obrigatório") || result.error.includes("longo")
      ? 400
      : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ id: result.id }, { status: 201 });
}
