import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./auth/tenants";

/** Origem do contato: conversa (WhatsApp etc.), manual, importação. */
export const contactSourceEnum = ["conversation", "manual", "import"] as const;

/**
 * Contatos do tenant. Podem ser criados a partir de conversas (número/email) ou manualmente/importação.
 * Deduplicação por normalized_phone e normalized_email no tenant.
 */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 64 }),
    normalizedEmail: varchar("normalized_email", { length: 255 }),
    normalizedPhone: varchar("normalized_phone", { length: 64 }),
    /** conversation | manual | import */
    source: varchar("source", { length: 32 }).notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    contacts_tenant_idx: index("contacts_tenant_idx").on(t.tenantId),
    contacts_tenant_phone_idx: index("contacts_tenant_phone_idx").on(
      t.tenantId,
      t.normalizedPhone
    ),
    contacts_tenant_email_idx: index("contacts_tenant_email_idx").on(
      t.tenantId,
      t.normalizedEmail
    ),
    contacts_tenant_normalized_phone_unique: uniqueIndex(
      "contacts_tenant_normalized_phone_unique"
    )
      .on(t.tenantId, t.normalizedPhone)
      .where(sql`${t.normalizedPhone} IS NOT NULL AND ${t.normalizedPhone} != ''`),
    contacts_tenant_normalized_email_unique: uniqueIndex(
      "contacts_tenant_normalized_email_unique"
    )
      .on(t.tenantId, t.normalizedEmail)
      .where(sql`${t.normalizedEmail} IS NOT NULL AND ${t.normalizedEmail} != ''`),
  })
);
