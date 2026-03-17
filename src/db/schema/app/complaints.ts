import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "../auth/tenants";
import { users } from "../auth/users";

/**
 * Reclamações / feedback negativo do cliente (tenant) sobre o serviço.
 * status: open | in_progress | closed
 */
export const complaints = pgTable(
  "complaints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subject: varchar("subject", { length: 255 }),
    body: text("body").notNull(),
    /** open | in_progress | closed */
    status: varchar("status", { length: 32 }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    complaints_tenant_idx: index("complaints_tenant_idx").on(t.tenantId),
    complaints_status_idx: index("complaints_status_idx").on(t.status),
  })
);
