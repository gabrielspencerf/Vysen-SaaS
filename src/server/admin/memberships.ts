/**
 * Memberships: listar por tenant ou usuário; criar (vincular usuário a tenant com role).
 * Não faz checagem de permissão — chamador deve usar requireAdmin.
 * Impede duplicidade (user_id + tenant_id único).
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "@/server/db";
import { memberships, users, tenants, roles } from "@/db/schema";

export interface MembershipRow {
  id: string;
  userId: string;
  tenantId: string;
  roleId: string;
  userEmail: string;
  userName: string | null;
  tenantName: string;
  tenantSlug: string;
  roleSlug: string;
  roleName: string;
}

export interface CreateMembershipInput {
  userId: string;
  tenantId: string;
  roleSlug: string;
  invitedBy: string;
}

export async function listMembershipsByTenant(
  tenantId: string
): Promise<MembershipRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: memberships.id,
      userId: memberships.userId,
      tenantId: memberships.tenantId,
      roleId: memberships.roleId,
      userEmail: users.email,
      userName: users.name,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      roleSlug: roles.slug,
      roleName: roles.name,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
    .innerJoin(roles, eq(memberships.roleId, roles.id))
    .where(eq(memberships.tenantId, tenantId));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    tenantId: r.tenantId,
    roleId: r.roleId,
    userEmail: r.userEmail,
    userName: r.userName,
    tenantName: r.tenantName,
    tenantSlug: r.tenantSlug,
    roleSlug: r.roleSlug,
    roleName: r.roleName,
  }));
}

export async function listMembershipsByUser(
  userId: string
): Promise<MembershipRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: memberships.id,
      userId: memberships.userId,
      tenantId: memberships.tenantId,
      roleId: memberships.roleId,
      userEmail: users.email,
      userName: users.name,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      roleSlug: roles.slug,
      roleName: roles.name,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .innerJoin(tenants, eq(memberships.tenantId, tenants.id))
    .innerJoin(roles, eq(memberships.roleId, roles.id))
    .where(eq(memberships.userId, userId));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    tenantId: r.tenantId,
    roleId: r.roleId,
    userEmail: r.userEmail,
    userName: r.userName,
    tenantName: r.tenantName,
    tenantSlug: r.tenantSlug,
    roleSlug: r.roleSlug,
    roleName: r.roleName,
  }));
}

export async function createMembership(
  input: CreateMembershipInput
): Promise<{ id: string } | { error: string }> {
  const db = getDb();
  const { userId, tenantId, roleSlug, invitedBy } = input;
  if (!userId || !tenantId || !roleSlug) {
    return { error: "user_id, tenant_id e role_slug são obrigatórios" };
  }

  const [roleRow] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.slug, roleSlug))
    .limit(1);
  if (!roleRow) return { error: "Role não encontrada" };

  const [existing] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.tenantId, tenantId)
      )
    )
    .limit(1);
  if (existing) {
    return { error: "Este usuário já possui membership neste tenant" };
  }

  try {
    const [inserted] = await db
      .insert(memberships)
      .values({
        userId,
        tenantId,
        roleId: roleRow.id,
        invitedAt: new Date(),
        invitedBy: invitedBy || null,
      })
      .returning({ id: memberships.id });
    if (!inserted) return { error: "Falha ao criar membership" };
    return { id: inserted.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { error: "Este usuário já possui membership neste tenant" };
    }
    return { error: "Erro ao criar membership" };
  }
}

/**
 * Troca a role de um membership existente. Identificação pelo ID do
 * membership (não pelo par userId/tenantId, que muda menos).
 */
export async function updateMembershipRole(input: {
  membershipId: string;
  roleSlug: string;
}): Promise<{ ok: true; tenantId: string; userId: string } | { error: string }> {
  const db = getDb();
  const [roleRow] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.slug, input.roleSlug))
    .limit(1);
  if (!roleRow) return { error: "Role não encontrada" };
  const [existing] = await db
    .select({ tenantId: memberships.tenantId, userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.id, input.membershipId))
    .limit(1);
  if (!existing) return { error: "Membership não encontrado" };
  await db
    .update(memberships)
    .set({ roleId: roleRow.id })
    .where(eq(memberships.id, input.membershipId));
  return { ok: true, tenantId: existing.tenantId, userId: existing.userId };
}

export async function deleteMembership(
  membershipId: string
): Promise<{ ok: true; tenantId: string; userId: string } | { error: string }> {
  const db = getDb();
  const [existing] = await db
    .select({ tenantId: memberships.tenantId, userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.id, membershipId))
    .limit(1);
  if (!existing) return { error: "Membership não encontrado" };
  await db.delete(memberships).where(eq(memberships.id, membershipId));
  return { ok: true, tenantId: existing.tenantId, userId: existing.userId };
}
