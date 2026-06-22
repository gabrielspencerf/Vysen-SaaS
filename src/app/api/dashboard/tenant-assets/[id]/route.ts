/**
 * DELETE /api/dashboard/tenant-assets/[id] — remove arquivo.
 */
import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { deleteTenantAsset } from "@/server/dashboard";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID do arquivo é obrigatório" }, { status: 400 });
  }

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;
      const result = await deleteTenantAsset(tenantId, id);
      if (!result.ok) {
        return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }, PERMISSION_SLUGS.LEADS_WRITE);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
