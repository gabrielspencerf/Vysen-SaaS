/**
 * GET /api/dashboard/products — lista produtos do tenant.
 * POST /api/dashboard/products — cria produto (body: name, description?, unitPrice, currency?).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import {
  listProductsForTenant,
  createProductForTenant,
} from "@/server/dashboard";
import { recordTenantActivity } from "@/server/tenancy/tenant-activity";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireDashboardApiAuth(request, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }

  const tenantId = session.session.currentTenantId!;

  const { searchParams } = new URL(request.url);
  const activeOnly = searchParams.get("activeOnly") === "true";
  const list = await listProductsForTenant(tenantId, { activeOnly });
  return NextResponse.json(list);
}

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
  await recordTenantActivity({
    tenantId,
    actorUserId: session.user.id,
    scope: "products_leads",
    action: "create",
    notificationType: "product_created",
    title: "Produto criado",
    message: `Produto "${name}" foi criado na conta.`,
    resourceType: "product",
    resourceId: result.id,
    newValues: {
      name,
      unitPrice,
      currency: currency ?? null,
      billingType,
      billingInterval: billingInterval ?? null,
    },
    metadata: {
      productId: result.id,
    },
  });
  return NextResponse.json({ ok: true, id: result.id });
}
