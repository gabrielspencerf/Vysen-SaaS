/**
 * POST /api/webhooks/uazapi/[instanceId]
 * Recebe webhook UAZAPI; valida (instance por UUID); persiste raw event; enfileira job.
 * Paridade com Evolution. Ver docs/EVOLUTION_WEBHOOK_DEBUG.md (fluxo análogo).
 */

import { NextRequest, NextResponse } from "next/server";
import { validateUazapiWebhook } from "@/server/integrations/uazapi/validate";
import { parseUazapiWebhookBody } from "@/server/integrations/uazapi/parse";
import { ingestUazapiWebhook } from "@/server/integrations/uazapi/ingest";
import { checkRateLimit } from "@/server/security/rate-limit";

const MAX_BODY_SIZE = 512 * 1024; // 512 KB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const { instanceId } = await params;
  const instanceIdOrToken =
    instanceId ?? request.nextUrl.searchParams.get("instance") ?? "";

  if (!instanceIdOrToken) {
    return NextResponse.json(
      { error: "Instance identifier required" },
      { status: 400 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
  }

  const rateLimit = await checkRateLimit({
    request,
    bucket: "webhook:uazapi",
    max: 120,
    windowSeconds: 60,
    resourceKey: instanceIdOrToken,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  let body: unknown;
  let rawBody = "";
  try {
    rawBody = await request.text();
    if (rawBody.length > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "Payload too large" },
        { status: 413 }
      );
    }
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const context = await validateUazapiWebhook(instanceIdOrToken);
  if ("error" in context) {
    return NextResponse.json(
      { error: context.error },
      { status: context.status }
    );
  }

  const parsed = parseUazapiWebhookBody(body);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400 }
    );
  }

  const result = await ingestUazapiWebhook({
    tenantId: context.tenantId,
    uazapiInstanceId: context.uazapiInstanceId,
    eventType: parsed.eventType,
    payload: parsed.payload,
    externalEventId: parsed.externalEventId,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { received: true, id: result.rawEventId },
    { status: 200 }
  );
}
