/**
 * GET /api/dashboard/products — lista produtos do tenant.
 * POST /api/dashboard/products — cria produto (body: name, description?, unitPrice, currency?).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import {
  listProductsForTenant,
  createProductForTenant,
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

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const list = await listProductsForTenant(tenantId, { activeOnly });
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
  const unitPrice =
    typeof body.unitPrice === "string"
      ? body.unitPrice
      : typeof body.unitPrice === "number"
        ? String(body.unitPrice)
        : "";
  if (!name || !unitPrice) {
    return NextResponse.json(
      { error: "Nome e valor (unitPrice) são obrigatórios" },
      { status: 400 }
    );
  }

  const description =
    body.description !== undefined && body.description !== null
      ? String(body.description)
      : undefined;
  const currency =
    typeof body.currency === "string" ? body.currency : undefined;
  const billingType =
    body.billingType === "recurring" ? "recurring" : "one_time";
  const billingInterval =
    billingType === "recurring" && (body.billingInterval === "monthly" || body.billingInterval === "yearly")
      ? body.billingInterval
      : billingType === "recurring"
        ? "monthly"
        : undefined;

  const result = await createProductForTenant(tenantId, {
    name,
    description,
    unitPrice,
    currency,
    billingType,
    billingInterval: billingInterval ?? null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, id: result.id });
}
