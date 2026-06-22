import { NextRequest, NextResponse } from "next/server";
import { withDashboardApiAuth } from "@/server/dashboard/api-auth";
import { dashboardApiAuthErrorResponse } from "@/server/dashboard/api-route-errors";
import { PERMISSION_SLUGS } from "@/server/rbac";
import { getClarityConnectionById } from "@/server/integrations/clarity/accounts";
import { createRedisClient } from "@/server/redis";
import { enqueueWithDedup } from "@/workers/queue";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  try {
    return await withDashboardApiAuth(request, async (session) => {
      const tenantId = session.session.currentTenantId!;

      const conn = await getClarityConnectionById(id);
      if (!conn || conn.tenantId !== tenantId) {
        return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
      }

      const redis = createRedisClient();
      let dedupResult = { enqueued: false };
      try {
        dedupResult = await enqueueWithDedup(
          redis,
          { type: "sync_clarity_connection", connectionId: id },
          { dedupKey: `sync:clarity:${id}` }
        );
      } finally {
        await redis.quit().catch(() => {});
      }

      return NextResponse.json({ ok: true, enqueued: dedupResult.enqueued });
    }, PERMISSION_SLUGS.DASHBOARD_READ);
  } catch (err) {
    return dashboardApiAuthErrorResponse(err);
  }
}
