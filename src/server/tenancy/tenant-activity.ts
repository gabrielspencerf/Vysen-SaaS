import { notifyTenantUsers } from "@/server/notifications/internal";
import { writeAuditLog } from "@/server/audit/log";
import type { TenantAuditScope } from "./tenant-features";
import {
  canUseTenantAudit,
  canUseTenantNotifications,
} from "./tenant-features";

type ActivityAction = "create" | "update" | "delete";

export interface RecordTenantActivityInput {
  tenantId: string;
  actorUserId?: string | null;
  scope: TenantAuditScope;
  action: ActivityAction;
  title: string;
  message: string;
  notificationType: string;
  resourceType: string;
  resourceId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordTenantActivity(
  input: RecordTenantActivityInput
): Promise<void> {
  const [notifyEnabled, auditEnabled] = await Promise.all([
    canUseTenantNotifications(input.tenantId),
    canUseTenantAudit(input.tenantId, input.scope),
  ]);

  const tasks: Promise<void>[] = [];

  if (notifyEnabled) {
    tasks.push(
      notifyTenantUsers(input.tenantId, {
        type: input.notificationType,
        title: input.title,
        message: input.message,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata ?? null,
      })
    );
  }

  if (auditEnabled) {
    tasks.push(
      writeAuditLog({
        tenantId: input.tenantId,
        userId: input.actorUserId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        oldValues: input.oldValues ?? null,
        newValues: input.newValues ?? null,
      })
    );
  }

  await Promise.all(tasks);
}

