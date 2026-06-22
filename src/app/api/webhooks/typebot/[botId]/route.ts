/**
 * POST /api/webhooks/typebot/[botId]
 * Recebe webhook Typebot; valida (bot + secret); persiste raw event; enfileira job.
 * Não exige autenticação de usuário; identificação por URL/secret. Ver docs/BASE2_ETAPA1.md.
 */

import { NextRequest } from "next/server";
import type { TypebotWebhookContext } from "@/server/integrations/typebot";
import { parseTypebotWebhookBody, ingestTypebotWebhook } from "@/server/integrations/typebot";
import { checkRateLimit } from "@/server/security/rate-limit";
import { withWebhookRlsTransaction } from "@/server/db/webhook-transaction";
import { validateWebhookRequest } from "@/server/security/webhook-request";
import { checkWebhookReplay } from "@/server/security/webhook-replay";
import { apiError, apiOk, webhookResponseHeaders } from "@/server/http/api-contract";
import { emitDomainEvent } from "@/server/observability/domain-events";

const MAX_BODY_SIZE = 512 * 1024; // 512 KB
const WEBHOOK_REPLAY_WINDOW_SECONDS = 10 * 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params;
  const botIdOrToken = botId ?? request.nextUrl.searchParams.get("bot") ?? "";

  if (!botIdOrToken) {
    return apiError("resource_required", "Bot identifier required", { status: 400 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return apiError("invalid_content_type", "Content-Type must be application/json", {
      status: 415,
    });
  }

  const rateLimit = await checkRateLimit({
    request,
    bucket: "webhook:typebot",
    max: 120,
    windowSeconds: 60,
    resourceKey: botIdOrToken,
  });
  if (!rateLimit.allowed) {
    return apiError("rate_limited", "Rate limit exceeded", {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }

  let body: unknown;
  let rawBody = "";
  try {
    rawBody = await request.text();
    if (rawBody.length > MAX_BODY_SIZE) {
      return apiError("payload_too_large", "Payload too large", { status: 413 });
    }
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return apiError("invalid_json", "Invalid JSON body", { status: 400 });
  }

  return withWebhookRlsTransaction(async (lockToTenant) => {
    const context = await validateWebhookRequest(
      "typebot",
      request,
      rawBody,
      botIdOrToken
    );
    if ("error" in context) {
      return apiError("webhook_validation_failed", context.error, { status: context.status });
    }
    const typebotContext = context as TypebotWebhookContext;

    await lockToTenant(typebotContext.tenantId);

    const parsed = parseTypebotWebhookBody(body);
    if ("error" in parsed) {
      return apiError("invalid_payload", parsed.error, { status: 400 });
    }

    const replay = await checkWebhookReplay({
      provider: "typebot",
      resourceId: typebotContext.typebotBotId,
      externalEventId: parsed.externalEventId,
      timestampHeader: request.headers.get("x-webhook-timestamp"),
      signatureHeader: request.headers.get("x-webhook-signature"),
      rawBody,
    });
    if (!replay.ok) {
      return apiError("replay_detected", "Webhook replay detectado", { status: 409 });
    }

    const result = await ingestTypebotWebhook({
      tenantId: typebotContext.tenantId,
      typebotBotId: typebotContext.typebotBotId,
      payload: parsed.payload,
      externalEventId: parsed.externalEventId,
    });

    if ("error" in result) {
      if (result.error === "Not implemented") {
        return apiError("not_implemented", "Webhook ingestion not implemented yet", {
          status: 501,
        });
      }
      emitDomainEvent({
        name: "webhook.typebot.ingest_failed",
        level: "error",
        tenantId: typebotContext.tenantId,
        metadata: { botId: typebotContext.typebotBotId, reason: result.error },
      });
      return apiError("ingest_failed", result.error, { status: 500 });
    }

    emitDomainEvent({
      name: "webhook.typebot.ingested",
      tenantId: typebotContext.tenantId,
      metadata: { botId: typebotContext.typebotBotId, rawEventId: result.rawEventId },
    });
    return apiOk(
      { received: true, id: result.rawEventId },
      {
        headers: webhookResponseHeaders({
          eventId: parsed.externalEventId ?? result.rawEventId,
          replayWindowSeconds: WEBHOOK_REPLAY_WINDOW_SECONDS,
        }),
      }
    );
  });
}
