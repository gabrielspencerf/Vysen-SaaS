/**
 * POST /api/admin/integrations/typebot — criar bot Typebot (super_admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin/require-admin";
import { createTypebotBot } from "@/server/admin/integrations-create";
import { checkRateLimit } from "@/server/security/rate-limit";
import { listTypebotBots } from "@/server/admin/integrations-stats";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json(
      { error: e.status === 403 ? "Sem permissão" : "Não autenticado" },
      { status: e.status ?? 401 }
    );
  }

  const bots = await listTypebotBots();
  return NextResponse.json({
    bots: bots.map((bot) => ({
      id: bot.id,
      name: bot.name,
      externalId: bot.externalId,
      tenantId: bot.tenantId,
      tenantName: bot.tenantName,
    })),
  });
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdmin(request);
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json(
      { error: e.status === 403 ? "Sem permissão" : "Não autenticado" },
      { status: e.status ?? 401 }
    );
  }

  let body: {
    tenant_id?: string;
    external_id?: string;
    name?: string;
    webhook_secret?: string;
    api_token?: string;
    metrics_api_base_url?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const tenantId = body.tenant_id?.trim();
  const externalId = body.external_id?.trim();
  if (!tenantId || !externalId) {
    return NextResponse.json(
      { error: "tenant_id e external_id são obrigatórios" },
      { status: 400 }
    );
  }

  const limiter = await checkRateLimit({
    request,
    bucket: "admin:create-typebot",
    max: 30,
    windowSeconds: 60,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(limiter.retryAfterSeconds) },
      }
    );
  }

  const result = await createTypebotBot({
    tenantId,
    externalId,
    name: body.name ?? null,
    webhookSecret: body.webhook_secret ?? null,
    apiToken: body.api_token ?? null,
    metricsApiBaseUrl: body.metrics_api_base_url ?? null,
    actorUserId: session.user.id,
  });

  if ("error" in result) {
    const message = result.error ?? "Erro ao criar bot";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Já existe") ? 409 : 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const webhookUrl = appUrl
    ? `${appUrl.replace(/\/$/, "")}/api/webhooks/typebot/${result.id}`
    : `[NEXT_PUBLIC_APP_URL]/api/webhooks/typebot/${result.id}`;

  return NextResponse.json(
    { ...result, webhook_url: webhookUrl },
    { status: 201 }
  );
}
