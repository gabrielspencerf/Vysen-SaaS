/**
 * POST /api/dashboard/meta-ads/pixel
 * Atualiza pixel (CAPI) da conta Meta do tenant.
 */

import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { getMetaAdsAccountById, updateMetaAdsAccountPixelId } from "@/server/integrations/meta-ads";

export async function POST(request: NextRequest) {
  let accountId: string | undefined;
  let pixelId: string | undefined;
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = (await request.json()) as { accountId?: string; pixelId?: string | null };
      accountId = body.accountId;
      pixelId = body.pixelId === null || body.pixelId === "" ? "" : body.pixelId;
    } else {
      const form = await request.formData();
      accountId = form.get("accountId")?.toString();
      const raw = form.get("pixelId")?.toString() ?? "";
      pixelId = raw.trim();
    }
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  if (!accountId) {
    return NextResponse.json({ error: "accountId obrigatório" }, { status: 400 });
  }

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;

      const account = await getMetaAdsAccountById(accountId!);
      if (!account || account.tenantId !== tenantId) {
        return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
      }

      await updateMetaAdsAccountPixelId(
        accountId!,
        pixelId === "" || pixelId === undefined ? null : pixelId
      );

      return NextResponse.json({ ok: true });
    }, PERMISSION_SLUGS.LEADS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
