/**
 * DELETE /api/admin/integrations/typebot/[id] — excluir bot Typebot (super_admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin/require-admin";
import { deleteTypebotBot } from "@/server/admin/integrations-delete";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAdmin(request);
  } catch (err) {
    const e = err as Error & { status?: number };
    return NextResponse.json(
      { error: e.status === 403 ? "Sem permissão" : "Não autenticado" },
      { status: e.status ?? 401 }
    );
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
