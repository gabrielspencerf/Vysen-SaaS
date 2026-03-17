/**
 * GET /api/dashboard/pagespeed/results — lista resultados por data e dispositivo.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { listPageSpeedResultsForTenant } from "@/server/dashboard";

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

  const list = await listPageSpeedResultsForTenant(tenantId, { limit: 60 });
  const serialized = list.map((r) => ({
    ...r,
    metricDate: r.metricDate.toISOString().slice(0, 10),
    fetchedAt: r.fetchedAt.toISOString(),
  }));
  return NextResponse.json(serialized);
}
