/**
 * PATCH /api/admin/memberships/[id] — trocar role do membership.
 * DELETE /api/admin/memberships/[id] — remover membership do usuário/tenant.
 *
 * Apenas super_admin global (requireAdmin). Registra atividade no tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/admin/require-admin";
import {
  updateMembershipRole,
  deleteMembership,
} from "@/server/admin/memberships";
import { recordTenantActivity } from "@/server/tenancy/tenant-activity";

export async function PATCH(
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
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  let body: { role_slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }
  const roleSlug = typeof body.role_slug === "string" ? body.role_slug.trim() : "";
  if (!roleSlug) {
    return NextResponse.json(
      { error: "role_slug é obrigatório" },
      { status: 400 }
    );
  }

  const result = await updateMembershipRole({ membershipId: id, roleSlug });
  if ("error" in result) {
    const status =
      result.error === "Membership não encontrado"
        ? 404
        : result.error === "Role não encontrada"
          ? 400
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  await recordTenantActivity({
    tenantId: result.tenantId,
    actorUserId: session.user.id,
    scope: "users_memberships",
    action: "update",
    notificationType: "membership_updated",
    title: "Role do membership atualizada",
    message: `Role alterada para ${roleSlug}.`,
    resourceType: "membership",
    resourceId: id,
    newValues: { roleSlug, userId: result.userId },
  });
  return NextResponse.json({ ok: true });
}

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
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  const result = await deleteMembership(id);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.error === "Membership não encontrado" ? 404 : 400 }
    );
  }
  await recordTenantActivity({
    tenantId: result.tenantId,
    actorUserId: session.user.id,
    scope: "users_memberships",
    action: "delete",
    notificationType: "membership_deleted",
    title: "Membership removido",
    message: "Usuário desvinculado do tenant.",
    resourceType: "membership",
    resourceId: id,
    newValues: { userId: result.userId },
  });
  return NextResponse.json({ ok: true });
}
