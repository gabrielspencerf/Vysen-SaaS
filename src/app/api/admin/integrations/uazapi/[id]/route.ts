/**
 * GET/PATCH/DELETE /api/admin/integrations/uazapi/[id] — gestão de instância UAZAPI (super_admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin/require-admin";
import { deleteUazapiInstance } from "@/server/admin/integrations-delete";
import {
  getUazapiInstanceById,
  updateUazapiInstanceById,
} from "@/server/admin/integrations-update";
import { validateUazapiCredential } from "@/lib/uazapi-credentials";

async function ensureAdmin(request: NextRequest) {
  try {
    await requireAdmin(request);
    return null;
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json(
      { error: e.status === 403 ? "Sem permissão" : "Não autenticado" },
      { status: e.status ?? 401 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await ensureAdmin(request);
  if (authError) return authError;

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "ID da instância é obrigatório" }, { status: 400 });
  }

  const result = await getUazapiInstanceById(id.trim());
  if ("error" in result) {
    return NextResponse.json({ error: "Instância UAZAPI não encontrada" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await ensureAdmin(request);
  if (authError) return authError;
  const adminSession = await requireAdmin(request);

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "ID da instância é obrigatório" }, { status: 400 });
  }

  let body: {
    external_id?: string;
    base_url?: string;
    instance_name?: string;
    api_key?: string;
    token?: string;
    admin_token?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const externalId = body.external_id?.trim();
  const baseUrl = body.base_url?.trim();
  if (!externalId || !baseUrl) {
    return NextResponse.json(
      { error: "external_id e base_url são obrigatórios" },
      { status: 400 }
    );
  }
  const credentialError = validateUazapiCredential({
    apiKey: body.api_key ?? null,
    token: body.token ?? null,
    adminToken: body.admin_token ?? null,
  });
  if (credentialError) {
    return NextResponse.json({ error: credentialError }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof updateUazapiInstanceById>>;
  try {
    result = await updateUazapiInstanceById({
      id: id.trim(),
      externalId,
      baseUrl,
      instanceName: body.instance_name ?? null,
      apiKey: body.api_key ?? null,
      token: body.token ?? null,
      adminToken: body.admin_token ?? null,
      actorUserId: adminSession.user.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("INTEGRATIONS_ENCRYPTION_KEY") ||
      message.includes("CONFIG_ENCRYPTION_KEY") ||
      message.includes("Chave inválida")
    ) {
      return NextResponse.json(
        {
          error:
            "Não foi possível salvar a credencial por configuração de criptografia. Defina INTEGRATIONS_ENCRYPTION_KEY/CONFIG_ENCRYPTION_KEY.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Erro interno ao atualizar instância UAZAPI" }, { status: 500 });
  }

  if ("error" in result) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Instância UAZAPI não encontrada" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Já existe uma instância UAZAPI com este tenant e external_id" },
      { status: 409 }
    );
  }

  return NextResponse.json(result, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await ensureAdmin(request);
  if (authError) return authError;
  const adminSession = await requireAdmin(request);

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json(
      { error: "ID da instância é obrigatório" },
      { status: 400 }
    );
  }

  const result = await deleteUazapiInstance(id.trim(), adminSession.user.id);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.includes("não encontrada") ? 404 : 500 }
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
