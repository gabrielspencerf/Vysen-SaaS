/**
 * POST /api/google-ads/sync/[accountId]
 * Dispara sync sob demanda para uma conta. Exige sessão e que a conta pertença ao tenant atual.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { getCurrentMembership } from "@/server/tenancy/membership";
import { getGoogleAdsAccountById } from "@/server/integrations/google-ads";
import { createRedisClient } from "@/server/redis";
import { enqueueWithDedup } from "@/workers/queue";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ accountId: string }> }
) {
  let session;
  try {
    session = await requireAuth(_request);
  } catch (err) {
    const e = err as Error & { status?: number };
    const status = e.status ?? 401;
    const url = new URL(_request.url);
    const dest =
      status === 403
        ? `/dashboard/google-ads?google_ads_error=csrf`
        : `/login?from=${encodeURIComponent("/dashboard/google-ads")}`;
    return NextResponse.redirect(new URL(dest, url.origin), { status: 302 });
  }

  const currentTenantId = session.session.currentTenantId;
  if (!currentTenantId) {
    return NextResponse.json(
      { error: "Selecione um tenant" },
      { status: 400 }
    );
  }

  const membership = await getCurrentMembership(
    session.user.id,
    currentTenantId
  );
  if (!membership) {
    return NextResponse.json(
      { error: "Sem acesso a este tenant" },
      { status: 403 }
    );
  }

  const { accountId } = await context.params;
  if (!accountId) {
    return NextResponse.json(
      { error: "accountId é obrigatório" },
      { status: 400 }
    );
  }

  const account = await getGoogleAdsAccountById(accountId);
  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }
  if (account.tenantId !== currentTenantId) {
    return NextResponse.json(
      { error: "Conta não pertence ao tenant atual" },
      { status: 403 }
    );
  }

  const redis = createRedisClient();
  let dedupResult = { enqueued: false };
  try {
    dedupResult = await enqueueWithDedup(
      redis,
      { type: "sync_google_ads_account", accountId },
      { dedupKey: `sync:gads:${accountId}` }
    );
  } finally {
    await redis.quit().catch(() => {});
  }

  const url = new URL(_request.url);
  const status = dedupResult.enqueued ? "enqueued" : "already_in_flight";
  const redirectTo = `${url.origin}/dashboard/google-ads?sync=${status}`;
  return NextResponse.redirect(redirectTo, { status: 302 });
}
