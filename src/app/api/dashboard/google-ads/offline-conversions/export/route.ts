import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { buildCsvRow } from "@/lib/csv";
import { buildGoogleOfflineExportForTenant } from "@/server/dashboard/google-ads-offline-conversions";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const conversionName = searchParams.get("conversionName") ?? undefined;
  const currencyCode = searchParams.get("currencyCode") ?? undefined;

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;

      const { headers, rows } = await buildGoogleOfflineExportForTenant(tenantId, {
        limit: 5000,
        conversionName,
        currencyCode,
      });

      const lines = [buildCsvRow([...headers]), ...rows.map((row) => buildCsvRow(row))];
      const csv = "﻿" + lines.join("\r\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="google-offline-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }, PERMISSION_SLUGS.LEADS_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
