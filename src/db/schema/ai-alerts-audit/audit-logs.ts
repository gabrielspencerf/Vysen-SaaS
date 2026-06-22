import { index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "../auth/tenants";
import { users } from "../auth/users";
import { auditActionEnum } from "../../enums";

/**
 * Trilha de auditoria; append-only.
 * old_values/new_values devem ser sanitizados na aplicação (exclusão/mascaramento de segredos) antes do insert.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: auditActionEnum("action").notNull(),
    resourceType: varchar("resource_type", { length: 64 }),
    resourceId: varchar("resource_id", { length: 255 }),
    oldValues: jsonb("old_values").$type<Record<string, unknown>>(),
    newValues: jsonb("new_values").$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 512 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true, precision: 6 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    audit_logs_tenant_occurred_idx: index(
      "audit_logs_tenant_occurred_idx"
    ).on(t.tenantId, t.occurredAt),
    audit_logs_user_occurred_idx: index("audit_logs_user_occurred_idx").on(
      t.userId,
      t.occurredAt
    ),
    audit_logs_resource_idx: index("audit_logs_resource_idx").on(
      t.resourceType,
      t.resourceId
    ),
    audit_logs_action_occurred_idx: index(
      "audit_logs_action_occurred_idx"
    ).on(t.action, t.occurredAt),
  })
);
