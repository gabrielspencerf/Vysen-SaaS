/**
 * GET /api/dashboard/contacts/export — exporta contatos do tenant como CSV (UTF-8).
 * Query: search (opcional) para filtrar.
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { listContactsForTenant } from "@/server/dashboard";
import { buildCsvRow } from "@/lib/csv";

const EXPORT_LIMIT = 5000;

function formatIso(d: Date): string {
  return new Date(d).toISOString();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;

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

      const csv = "﻿" + lines.join("\r\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="contatos-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }, PERMISSION_SLUGS.LEADS_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
