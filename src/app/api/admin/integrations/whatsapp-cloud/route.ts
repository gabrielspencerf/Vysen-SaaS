/**
 * POST /api/admin/integrations/whatsapp-cloud — criar número WA Cloud (super_admin).
 * GET — listar números.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin/require-admin";
import { createWhatsappCloudNumber } from "@/server/admin/integrations-create";
import { checkRateLimit } from "@/server/security/rate-limit";
import { listWhatsappCloudNumbers } from "@/server/admin/integrations-stats";

function adminErrorResponse(err: unknown): NextResponse {
  const e = err as Error & { status?: number };
  return NextResponse.json(
    { error: e.status === 403 ? "Sem permissão" : "Não autenticado" },
    { status: e.status ?? 401 }
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (err) {
    return adminErrorResponse(err);
  }
  const numbers = await listWhatsappCloudNumbers();
  return NextResponse.json({ numbers });
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAdmin(request);
  } catch (err) {
    return adminErrorResponse(err);
  }

  let body: {
    tenant_id?: string;
    phone_number_id?: string;
    waba_id?: string;
    display_phone?: string;
    access_token?: string;
    webhook_verify_token?: string;
    label?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const tenantId = body.tenant_id?.trim();
  const phoneNumberId = body.phone_number_id?.trim();
  const wabaId = body.waba_id?.trim();
  if (!tenantId || !phoneNumberId || !wabaId) {
    return NextResponse.json(
      { error: "tenant_id, phone_number_id e waba_id são obrigatórios" },
      { status: 400 }
    );
  }

  const limiter = await checkRateLimit({
    request,
    bucket: "admin:create-whatsapp-cloud",
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

  const result = await createWhatsappCloudNumber({
    tenantId,
    phoneNumberId,
    wabaId,
    displayPhone: body.display_phone ?? null,
    accessToken: body.access_token ?? null,
    webhookVerifyToken: body.webhook_verify_token ?? null,
    label: body.label ?? null,
    actorUserId: session.user.id,
  });

  if ("error" in result) {
    const message = result.error ?? "Erro ao criar número";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Já existe") ? 409 : 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const webhookUrl = appUrl
    ? `${appUrl.replace(/\/$/, "")}/api/webhooks/whatsapp-cloud/${result.id}`
    : `[NEXT_PUBLIC_APP_URL]/api/webhooks/whatsapp-cloud/${result.id}`;

  return NextResponse.json({ ...result, webhook_url: webhookUrl }, { status: 201 });
}
