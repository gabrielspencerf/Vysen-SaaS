/**
 * POST /api/webhooks/chatwoot/[accountId]
 * Recebe webhook Chatwoot; valida HMAC-SHA256; persiste raw event; enfileira job.
 */

import { NextRequest } from "next/server";
import type { ChatwootWebhookContext } from "@/server/integrations/chatwoot";
import { parseChatwootWebhookBody, ingestChatwootWebhook } from "@/server/integrations/chatwoot";
import { checkRateLimit } from "@/server/security/rate-limit";
import { withWebhookRlsTransaction } from "@/server/db/webhook-transaction";
import { validateWebhookRequest } from "@/server/security/webhook-request";
import { checkWebhookReplay } from "@/server/security/webhook-replay";
import { apiError, apiOk, webhookResponseHeaders } from "@/server/http/api-contract";
import { emitDomainEvent } from "@/server/observability/domain-events";

const MAX_BODY_SIZE = 512 * 1024;
const WEBHOOK_REPLAY_WINDOW_SECONDS = 10 * 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;

  if (!accountId) {
    return apiError("resource_required", "Account identifier required", { status: 400 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return apiError("invalid_content_type", "Content-Type must be application/json", {
      status: 415,
    });
  }

  const rateLimit = await checkRateLimit({
    request,
    bucket: "webhook:chatwoot",
    max: 120,
    windowSeconds: 60,
    resourceKey: accountId,
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
      "chatwoot",
      request,
      rawBody,
      accountId
    );
    if ("error" in context) {
      return apiError("webhook_validation_failed", context.error, { status: context.status });
    }
    const chatwootContext = context as ChatwootWebhookContext;

    await lockToTenant(chatwootContext.tenantId);

    const parsed = parseChatwootWebhookBody(body);
    if ("error" in parsed) {
      return apiError("invalid_payload", parsed.error, { status: 400 });
    }

    const replay = await checkWebhookReplay({
      provider: "chatwoot",
      resourceId: chatwootContext.chatwootAccountId,
      externalEventId: parsed.externalEventId,
      timestampHeader: null,
      signatureHeader: request.headers.get("x-chatwoot-signature"),
      rawBody,
    });
    if (!replay.ok) {
      return apiError("replay_detected", "Webhook replay detectado", { status: 409 });
    }

    const result = await ingestChatwootWebhook({
      tenantId: chatwootContext.tenantId,
      chatwootAccountId: chatwootContext.chatwootAccountId,
      eventType: parsed.eventType,
      payload: parsed.payload,
      externalEventId: parsed.externalEventId,
    });

    if ("error" in result) {
      emitDomainEvent({
        name: "webhook.chatwoot.ingest_failed",
        level: "error",
        tenantId: chatwootContext.tenantId,
        metadata: {
          accountId: chatwootContext.chatwootAccountId,
          reason: result.error,
          eventType: parsed.eventType,
        },
      });
      return apiError("ingest_failed", result.error, { status: 500 });
    }

    emitDomainEvent({
      name: "webhook.chatwoot.ingested",
      tenantId: chatwootContext.tenantId,
      metadata: {
        accountId: chatwootContext.chatwootAccountId,
        rawEventId: result.rawEventId,
        eventType: parsed.eventType,
      },
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
