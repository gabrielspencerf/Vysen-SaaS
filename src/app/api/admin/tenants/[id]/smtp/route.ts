/**
 * GET    /api/admin/tenants/[id]/smtp — lê config SMTP do tenant (sem senha).
 * PUT    /api/admin/tenants/[id]/smtp — cria/atualiza config.
 *   Body: { host, port, username?, password?, from_email, from_name?,
 *           reply_to?, secure?, require_tls?, enabled? }
 *   password: ausente = mantém atual; "" = remove; preenchido = atualiza.
 * DELETE /api/admin/tenants/[id]/smtp — remove override do tenant (volta ao env).
 */
import { NextRequest } from "next/server";
import { requireAdmin } from "@/server/admin/require-admin";
import { adminApiAuthErrorResponse } from "@/server/admin/api-route-errors";
import { apiError, apiOk } from "@/server/http/api-contract";
import {
  deleteTenantSmtpConfig,
  getTenantSmtpConfig,
  upsertTenantSmtpConfig,
} from "@/server/admin/tenant-smtp";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
  } catch (err) {
    return adminApiAuthErrorResponse(err);
  }
  const { id } = await params;
  if (!id?.trim()) {
    return apiError("resource_required", "ID do tenant obrigatório", { status: 400 });
  }
  const result = await getTenantSmtpConfig(id.trim());
  return apiOk({ config: result });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAdmin(request);
  } catch (err) {
    return adminApiAuthErrorResponse(err);
  }
  const { id } = await params;
  if (!id?.trim()) {
    return apiError("resource_required", "ID do tenant obrigatório", { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_body", "Corpo inválido", { status: 400 });
  }

  const host = typeof body.host === "string" ? body.host : "";
  const fromEmail = typeof body.from_email === "string" ? body.from_email : "";
  const portRaw = body.port;
  const port =
    typeof portRaw === "number"
      ? portRaw
      : typeof portRaw === "string"
        ? Number(portRaw)
        : 587;

  const result = await upsertTenantSmtpConfig({
    tenantId: id.trim(),
    host,
    port,
    username: typeof body.username === "string" ? body.username : null,
    password:
      body.password === undefined
        ? undefined
        : typeof body.password === "string"
          ? body.password
          : null,
    fromEmail,
    fromName: typeof body.from_name === "string" ? body.from_name : null,
    replyTo: typeof body.reply_to === "string" ? body.reply_to : null,
    secure: body.secure === true,
    requireTls: body.require_tls !== false,
    enabled: body.enabled !== false,
    actorUserId: session.user.id,
  });

  if ("error" in result) {
    return apiError("invalid_payload", result.error, { status: 400 });
  }
  return apiOk({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAdmin(request);
  } catch (err) {
    return adminApiAuthErrorResponse(err);
  }
  const { id } = await params;
  if (!id?.trim()) {
    return apiError("resource_required", "ID do tenant obrigatório", { status: 400 });
  }
  const result = await deleteTenantSmtpConfig(id.trim(), session.user.id);
  if ("error" in result) {
    return apiError("not_found", result.error, { status: 404 });
  }
  return apiOk({ ok: true });
}
