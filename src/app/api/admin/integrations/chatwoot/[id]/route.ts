/**
 * GET /api/admin/integrations/chatwoot/[id] — detalhe (sem secrets).
 * PATCH /api/admin/integrations/chatwoot/[id] — atualiza campos editáveis.
 *   Body: { external_id?, base_url?, inbox_id?, label?, api_token? }
 *   - api_token: string vazia remove; ausente mantém.
 * DELETE /api/admin/integrations/chatwoot/[id] — exclui a conta.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin/require-admin";
import { deleteChatwootAccount } from "@/server/admin/integrations-delete";
import {
  getChatwootAccountById,
  updateChatwootAccountById,
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
  const result = await getChatwootAccountById(id.trim());
  if ("error" in result) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
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
  const result = await updateChatwootAccountById({
    id: id.trim(),
    externalId:
      typeof body.external_id === "string" ? body.external_id : undefined,
    baseUrl: typeof body.base_url === "string" ? body.base_url : undefined,
    inboxId:
      body.inbox_id === undefined
        ? undefined
        : typeof body.inbox_id === "string"
          ? body.inbox_id
          : null,
    label:
      body.label === undefined
        ? undefined
        : typeof body.label === "string"
          ? body.label
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
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Já existe uma conta Chatwoot com este external_id no tenant" },
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
  const result = await deleteChatwootAccount(id.trim(), session.user.id);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.includes("não encontrada") ? 404 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
