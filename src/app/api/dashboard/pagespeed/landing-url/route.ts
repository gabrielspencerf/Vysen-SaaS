/**
 * GET /api/dashboard/pagespeed/landing-url — retorna URL da landing do tenant.
 * PATCH /api/dashboard/pagespeed/landing-url — define URL (body: { url: string | null }).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import {
  getLandingPageUrlForTenant,
  setLandingPageUrlForTenant,
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

  const url = await getLandingPageUrlForTenant(tenantId);
  return NextResponse.json({ url });
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

  const url =
    body.url === null || body.url === undefined
      ? null
      : typeof body.url === "string"
        ? body.url.trim() || null
        : null;

  await setLandingPageUrlForTenant(tenantId, url);
  return NextResponse.json({ ok: true, url });
}
