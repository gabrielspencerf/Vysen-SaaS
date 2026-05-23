import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenants } from "../auth/tenants";

/**
 * Config SMTP por tenant — override do SMTP global (env). Quando ausente,
 * o `sendEmail` cai no fallback de variáveis de ambiente.
 *
 * password_encrypted: armazenado com encryptSecretForStorage; nunca exposto
 * via API. Existência sinalizada por `hasPassword: boolean`.
 */
export const tenantSmtpConfigs = pgTable("tenant_smtp_configs", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  host: varchar("host", { length: 255 }).notNull(),
  port: integer("port").notNull().default(587),
  username: varchar("username", { length: 255 }),
  passwordEncrypted: text("password_encrypted"),
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  fromName: varchar("from_name", { length: 255 }),
  replyTo: varchar("reply_to", { length: 255 }),
  secure: boolean("secure").notNull().default(false),
  requireTls: boolean("require_tls").notNull().default(true),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
