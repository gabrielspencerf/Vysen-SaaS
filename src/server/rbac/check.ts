/**
 * Checagem de permissões e roles (RBAC).
 * Fonte de verdade: tabelas roles, permissions, role_permissions, memberships.
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "@/server/db";
import { roles, permissions, rolePermissions } from "@/db/schema";
import { isSuperAdmin, getCurrentMembership } from "@/server/tenancy/membership";
import type { PermissionSlug, RoleSlug } from "./permissions";
import { GLOBAL_PERMISSION } from "./permissions";

/**
 * Verifica se a role tem a permissão (via role_permissions).
 */
export async function roleHasPermission(
  roleSlug: string,
  permissionSlug: string
): Promise<boolean> {
  const db = getDb();
  const [roleRow] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.slug, roleSlug))
    .limit(1);
  const [permRow] = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(eq(permissions.slug, permissionSlug))
    .limit(1);
  if (!roleRow || !permRow) return false;
  const [link] = await db
    .select({ roleId: rolePermissions.roleId })
    .from(rolePermissions)
    .where(
      and(
        eq(rolePermissions.roleId, roleRow.id),
        eq(rolePermissions.permissionId, permRow.id)
      )
    )
    .limit(1);
  return !!link;
}

/**
 * Verifica se o usuário tem a permissão no contexto dado.
 * - admin:access: usuário é super_admin (qualquer membership com role super_admin).
 * - Demais: exige tenantId; verifica membership e role_permissions.
 */
export async function hasPermission(
  userId: string,
  tenantId: string | null,
  permissionSlug: PermissionSlug
): Promise<boolean> {
  if (permissionSlug === GLOBAL_PERMISSION) {
    return isSuperAdmin(userId);
  }
  if (!tenantId) return false;
  const membership = await getCurrentMembership(userId, tenantId);
  if (!membership) return false;
  return roleHasPermission(membership.roleSlug, permissionSlug);
}

/**
 * Verifica se o usuário tem a role no tenant atual (ou é super_admin para comparação global).
 */
export async function hasRole(
  userId: string,
  tenantId: string | null,
  roleSlug: RoleSlug
): Promise<boolean> {
  if (roleSlug === "super_admin") {
    return isSuperAdmin(userId);
  }
  if (!tenantId) return false;
  const membership = await getCurrentMembership(userId, tenantId);
  return membership?.roleSlug === roleSlug;
}

/**
 * Exige a permissão; lança erro com status 403 se não tiver.
 * Para uso em route handlers após requireAuth().
 */
export async function requirePermission(
  userId: string,
  tenantId: string | null,
  permissionSlug: PermissionSlug
): Promise<void> {
  const ok = await hasPermission(userId, tenantId, permissionSlug);
  if (!ok) {
    const err = new Error("Sem permissão") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}

/**
 * Exige a role; lança erro com status 403 se não tiver.
 */
export async function requireRole(
  userId: string,
  tenantId: string | null,
  roleSlug: RoleSlug
): Promise<void> {
  const ok = await hasRole(userId, tenantId, roleSlug);
  if (!ok) {
    const err = new Error("Sem permissão para esta ação") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}
