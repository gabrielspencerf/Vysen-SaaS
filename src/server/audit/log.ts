import { auditLogs } from "@/db/schema";
import { getDb } from "@/server/db";
import { desc, eq } from "drizzle-orm";

type AuditAction =
  | "login"
  | "logout"
  | "tenant_switch"
  | "create"
  | "update"
  | "delete"
  | "password_change"
  | "membership_change"
  | "integration_change";

export async function writeAuditLog(input: {
  tenantId?: string | null;
  userId?: string | null;
  action: AuditAction;
  resourceType?: string | null;
  resourceId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const db = getDb();
  await db.insert(auditLogs).values({
    tenantId: input.tenantId ?? null,
    userId: input.userId ?? null,
    action: input.action,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    oldValues: input.oldValues ?? null,
    newValues: input.newValues ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    occurredAt: new Date(),
  });
}

export interface AuditLogRow {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  occurredAt: Date;
}

export async function listAuditLogsForTenant(input: {
  tenantId: string;
  limit?: number;
}): Promise<AuditLogRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: auditLogs.id,
      tenantId: auditLogs.tenantId,
      userId: auditLogs.userId,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      oldValues: auditLogs.oldValues,
      newValues: auditLogs.newValues,
      occurredAt: auditLogs.occurredAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.tenantId, input.tenantId))
    .orderBy(desc(auditLogs.occurredAt))
    .limit(input.limit ?? 100);

  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId ?? null,
    userId: row.userId ?? null,
    action: row.action,
    resourceType: row.resourceType ?? null,
    resourceId: row.resourceId ?? null,
    oldValues: (row.oldValues as Record<string, unknown> | null) ?? null,
    newValues: (row.newValues as Record<string, unknown> | null) ?? null,
    occurredAt: row.occurredAt,
  }));
}
