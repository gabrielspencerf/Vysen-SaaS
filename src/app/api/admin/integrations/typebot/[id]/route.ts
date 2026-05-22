/**
 * GET /api/admin/integrations/typebot/[id] — detalhe (sem secrets).
 * PATCH /api/admin/integrations/typebot/[id] — atualiza campos editáveis.
 *   Body: { external_id?, name?, metrics_api_base_url?, webhook_secret?, api_token? }
 *   - webhook_secret/api_token: string vazia remove; ausente mantém.
 * DELETE /api/admin/integrations/typebot/[id] — exclui o bot.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin/require-admin";
import { deleteTypebotBot } from "@/server/admin/integrations-delete";
import {
  getTypebotBotById,
  updateTypebotBotById,
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
  const result = await getTypebotBotById(id.trim());
  if ("error" in result) {
    return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });
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
  const result = await updateTypebotBotById({
    id: id.trim(),
    externalId: typeof body.external_id === "string" ? body.external_id : undefined,
    name:
      body.name === undefined
        ? undefined
        : typeof body.name === "string"
          ? body.name
          : null,
    metricsApiBaseUrl:
      body.metrics_api_base_url === undefined
        ? undefined
        : typeof body.metrics_api_base_url === "string"
          ? body.metrics_api_base_url
          : null,
    webhookSecret:
      body.webhook_secret === undefined
        ? undefined
        : typeof body.webhook_secret === "string"
          ? body.webhook_secret
          : null,
    apiToken:
      body.api_token === undefined
        ? undefined
        : typeof body.api_token === "string"
          ? body.api_token
          : null,
    actorUserId: session.user.id,
  });
  if ("error" in result) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Bot não encontrado" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Já existe um bot Typebot com este external_id no tenant" },
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
    return NextResponse.json(
      { error: "ID do bot é obrigatório" },
      { status: 400 }
    );
  }

  const result = await deleteTypebotBot(id.trim(), session.user.id);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.includes("não encontrado") ? 404 : 500 }
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
