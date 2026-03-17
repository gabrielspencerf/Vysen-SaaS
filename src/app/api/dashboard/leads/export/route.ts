/**
 * GET /api/dashboard/leads/export — exporta leads do tenant como CSV (UTF-8).
 * Query: search (opcional) para filtrar por nome, email ou telefone.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { listLeadsForTenant } from "@/server/dashboard";
import { buildCsvRow } from "@/lib/csv";

const EXPORT_LIMIT = 5000;

function formatIso(d: Date): string {
  return new Date(d).toISOString();
}

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
  const search = searchParams.get("search") ?? undefined;

  const leads = await listLeadsForTenant(tenantId, {
    search: search || undefined,
    limit: EXPORT_LIMIT,
  });

  const headers = [
    "id",
    "nome",
    "email",
    "telefone",
    "status",
    "origem",
    "primeiro_contato",
    "ultimo_contato",
  ];
  const lines: string[] = [buildCsvRow(headers)];
  for (const l of leads) {
    lines.push(
      buildCsvRow([
        l.id,
        l.name ?? "",
        l.email ?? "",
        l.phone ?? "",
        l.status,
        l.sourceProvider ?? "import",
        formatIso(l.firstSeenAt),
        formatIso(l.lastSeenAt),
      ])
    );
  }

  const csv = "\uFEFF" + lines.join("\r\n"); // BOM para Excel UTF-8
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
