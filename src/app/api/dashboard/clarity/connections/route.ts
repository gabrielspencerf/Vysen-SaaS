import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { createClarityConnection } from "@/server/integrations/clarity/accounts";

export async function POST(request: NextRequest) {
  let apiToken: string | undefined;
  let label: string | undefined;
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = (await request.json()) as { apiToken?: string; label?: string };
      apiToken = body.apiToken;
      label = body.label;
    } else {
      const form = await request.formData();
      apiToken = form.get("apiToken")?.toString();
      label = form.get("label")?.toString();
    }
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const created = await createClarityConnection({
        tenantId,
        apiToken: apiToken ?? "",
        label: label ?? null,
      });

      if ("error" in created) {
        return NextResponse.json({ error: created.error }, { status: 400 });
      }

      return NextResponse.json({ ok: true, id: created.id });
    }, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
