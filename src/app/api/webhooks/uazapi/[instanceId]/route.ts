/**
 * POST /api/webhooks/uazapi/[instanceId]
 * Recebe webhook UAZAPI; valida (instance por UUID); persiste raw event; enfileira job.
 * Paridade com Evolution. Ver docs/EVOLUTION_WEBHOOK_DEBUG.md (fluxo análogo).
 */

import { NextRequest } from "next/server";
import type { UazapiWebhookContext } from "@/server/integrations/uazapi";
import { parseUazapiWebhookBody } from "@/server/integrations/uazapi/parse";
import { ingestUazapiWebhook } from "@/server/integrations/uazapi/ingest";
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
    bucket: "webhook:uazapi",
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
      "uazapi",
      request,
      rawBody,
      instanceIdOrToken
    );
    if ("error" in context) {
      return apiError("webhook_validation_failed", context.error, { status: context.status });
    }
    const uazapiContext = context as UazapiWebhookContext;

    await lockToTenant(uazapiContext.tenantId);

    const parsed = parseUazapiWebhookBody(body);
    if ("error" in parsed) {
      return apiError("invalid_payload", parsed.error, { status: 400 });
    }

    const replay = await checkWebhookReplay({
      provider: "uazapi",
      resourceId: uazapiContext.uazapiInstanceId,
      externalEventId: parsed.externalEventId,
      timestampHeader: request.headers.get("x-webhook-timestamp"),
      signatureHeader: request.headers.get("x-webhook-signature"),
      rawBody,
    });
    if (!replay.ok) {
      return apiError("replay_detected", "Webhook replay detectado", { status: 409 });
    }

    const result = await ingestUazapiWebhook({
      tenantId: uazapiContext.tenantId,
      uazapiInstanceId: uazapiContext.uazapiInstanceId,
      eventType: parsed.eventType,
      payload: parsed.payload,
      externalEventId: parsed.externalEventId,
    });

    if ("error" in result) {
      emitDomainEvent({
        name: "webhook.uazapi.ingest_failed",
        level: "error",
        tenantId: uazapiContext.tenantId,
        metadata: {
          instanceId: uazapiContext.uazapiInstanceId,
          reason: result.error,
          eventType: parsed.eventType,
        },
      });
      return apiError("ingest_failed", result.error, { status: 500 });
    }

    emitDomainEvent({
      name: "webhook.uazapi.ingested",
      tenantId: uazapiContext.tenantId,
      metadata: {
        instanceId: uazapiContext.uazapiInstanceId,
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
