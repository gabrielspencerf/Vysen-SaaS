/**
 * POST /api/webhooks/evolution/[instanceId]
 * Recebe webhook Evolution; valida (instance + API key); persiste raw event; enfileira job.
 * Não exige autenticação de usuário; identificação por URL/token. Ver docs/BASE2_ETAPA1.md.
 */

import { NextRequest } from "next/server";
import type { EvolutionWebhookContext } from "@/server/integrations/evolution";
import { parseEvolutionWebhookBody, ingestEvolutionWebhook } from "@/server/integrations/evolution";
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
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const { instanceId } = await params;
  const instanceIdOrToken =
    instanceId ?? request.nextUrl.searchParams.get("instance") ?? "";

  if (!instanceIdOrToken) {
    return apiError("resource_required", "Instance identifier required", { status: 400 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return apiError("invalid_content_type", "Content-Type must be application/json", {
      status: 415,
    });
  }

  const rateLimit = await checkRateLimit({
    request,
    bucket: "webhook:evolution",
    max: 120,
    windowSeconds: 60,
    resourceKey: instanceIdOrToken,
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
      "evolution",
      request,
      rawBody,
      instanceIdOrToken
    );
    if ("error" in context) {
      return apiError("webhook_validation_failed", context.error, { status: context.status });
    }
    const evolutionContext = context as EvolutionWebhookContext;

    await lockToTenant(evolutionContext.tenantId);

    const parsed = parseEvolutionWebhookBody(body);
    if ("error" in parsed) {
      return apiError("invalid_payload", parsed.error, { status: 400 });
    }

    const replay = await checkWebhookReplay({
      provider: "evolution",
      resourceId: evolutionContext.evolutionInstanceId,
      externalEventId: parsed.externalEventId,
      timestampHeader: request.headers.get("x-webhook-timestamp"),
      signatureHeader: request.headers.get("x-webhook-signature"),
      rawBody,
    });
    if (!replay.ok) {
      return apiError("replay_detected", "Webhook replay detectado", { status: 409 });
    }

    const result = await ingestEvolutionWebhook({
      tenantId: evolutionContext.tenantId,
      evolutionInstanceId: evolutionContext.evolutionInstanceId,
      eventType: parsed.eventType,
      payload: parsed.payload,
      externalEventId: parsed.externalEventId,
    });

    if ("error" in result) {
      emitDomainEvent({
        name: "webhook.evolution.ingest_failed",
        level: "error",
        tenantId: evolutionContext.tenantId,
        metadata: {
          instanceId: evolutionContext.evolutionInstanceId,
          reason: result.error,
          eventType: parsed.eventType,
        },
      });
      return apiError("ingest_failed", result.error, { status: 500 });
    }

    emitDomainEvent({
      name: "webhook.evolution.ingested",
      tenantId: evolutionContext.tenantId,
      metadata: {
        instanceId: evolutionContext.evolutionInstanceId,
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
