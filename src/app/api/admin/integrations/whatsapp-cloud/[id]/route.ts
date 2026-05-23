/**
 * GET /api/admin/integrations/whatsapp-cloud/[id] — detalhe (sem secrets).
 * PATCH /api/admin/integrations/whatsapp-cloud/[id] — atualiza campos.
 *   Body: { phone_number_id?, waba_id?, display_phone?, label?, webhook_verify_token?, access_token? }
 *   - access_token: string vazia remove; ausente mantém.
 * DELETE /api/admin/integrations/whatsapp-cloud/[id] — exclui o número.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin/require-admin";
import { deleteWhatsappCloudNumber } from "@/server/admin/integrations-delete";
import {
  getWhatsappCloudNumberById,
  updateWhatsappCloudNumberById,
} from "@/server/admin/integrations-update";

function adminErrorResponse(err: unknown): NextResponse {
  const e = err as Error & { status?: number };
  return NextResponse.json(
    { error: e.status === 403 ? "Sem permissão" : "Não autenticado" },
    { status: e.status ?? 401 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
  } catch (err) {
    return adminErrorResponse(err);
  }
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  }
  const result = await getWhatsappCloudNumberById(id.trim());
  if ("error" in result) {
    return NextResponse.json({ error: "Número não encontrado" }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAdmin(request);
  } catch (err) {
    return adminErrorResponse(err);
  }
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }
  const result = await updateWhatsappCloudNumberById({
    id: id.trim(),
    phoneNumberId:
      typeof body.phone_number_id === "string" ? body.phone_number_id : undefined,
    wabaId: typeof body.waba_id === "string" ? body.waba_id : undefined,
    displayPhone:
      body.display_phone === undefined
        ? undefined
        : typeof body.display_phone === "string"
          ? body.display_phone
          : null,
    label:
      body.label === undefined
        ? undefined
        : typeof body.label === "string"
          ? body.label
          : null,
    webhookVerifyToken:
      body.webhook_verify_token === undefined
        ? undefined
        : typeof body.webhook_verify_token === "string"
          ? body.webhook_verify_token
          : null,
    accessToken:
      body.access_token === undefined
        ? undefined
        : typeof body.access_token === "string"
          ? body.access_token
          : null,
    actorUserId: session.user.id,
  });
  if ("error" in result) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Número não encontrado" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Já existe um número WhatsApp Cloud com este phone_number_id no tenant" },
      { status: 409 }
    );
  }
  return NextResponse.json(result);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAdmin(request);
  } catch (err) {
    return adminErrorResponse(err);
  }
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  }
  const result = await deleteWhatsappCloudNumber(id.trim(), session.user.id);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.includes("não encontrado") ? 404 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
