/**
 * GET /api/dashboard/leads/export — exporta leads do tenant como CSV (UTF-8).
 * Query: search (opcional) para filtrar por nome, email ou telefone.
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { listLeadsForTenant } from "@/server/dashboard";
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

      const csv = "﻿" + lines.join("\r\n"); // BOM para Excel UTF-8
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }, PERMISSION_SLUGS.LEADS_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
