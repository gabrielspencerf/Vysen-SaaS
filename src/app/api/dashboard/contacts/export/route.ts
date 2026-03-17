/**
 * GET /api/dashboard/contacts/export — exporta contatos do tenant como CSV (UTF-8).
 * Query: search (opcional) para filtrar.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { listContactsForTenant } from "@/server/dashboard";
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

  const contactsList = await listContactsForTenant(tenantId, {
    search: search || undefined,
    limit: EXPORT_LIMIT,
  });

  const headers = ["id", "nome", "email", "telefone", "origem", "criado_em", "atualizado_em"];
  const lines: string[] = [buildCsvRow(headers)];
  for (const c of contactsList) {
    lines.push(
      buildCsvRow([
        c.id,
        c.name ?? "",
        c.email ?? "",
        c.phone ?? "",
        c.source,
        formatIso(c.createdAt),
        formatIso(c.updatedAt),
      ])
    );
  }

  const csv = "\uFEFF" + lines.join("\r\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contatos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
