/**
 * GET/PATCH/DELETE /api/admin/integrations/evolution/[id] — gestão de instância Evolution (super_admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin/require-admin";
import { deleteEvolutionInstance } from "@/server/admin/integrations-delete";
import {
  getEvolutionInstanceById,
  updateEvolutionInstanceById,
} from "@/server/admin/integrations-update";

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

  const result = await getEvolutionInstanceById(id.trim());
  if ("error" in result) {
    return NextResponse.json({ error: "Instância Evolution não encontrada" }, { status: 404 });
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

  const result = await updateEvolutionInstanceById({
    id: id.trim(),
    externalId,
    baseUrl,
    instanceName: body.instance_name ?? null,
    apiKey: body.api_key ?? null,
    actorUserId: adminSession.user.id,
  });

  if ("error" in result) {
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Instância Evolution não encontrada" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Já existe uma instância Evolution com este tenant e external_id" },
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

  const result = await deleteEvolutionInstance(id.trim(), adminSession.user.id);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error.includes("não encontrada") ? 404 : 500 }
    );
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
