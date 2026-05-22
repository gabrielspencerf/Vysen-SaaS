import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "../auth/tenants";
import { integrations } from "../integrations/integrations";
import { funnels } from "./funnels";
import { funnelSteps } from "./funnel-steps";
import { providerEnum, leadStatusEnum } from "../../enums";

/**
 * Leads; deduplicação por normalized_email, normalized_phone e (tenant_id, source_provider, source_external_id).
 * Índices únicos parciais: verificar SQL gerado; se necessário, ver docs/db/SCHEMA_ORGANIZATION.md.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    status: leadStatusEnum("status").notNull().default("new"),
    sourceIntegrationId: uuid("source_integration_id").references(() => integrations.id, {
      onDelete: "set null",
    }),
    sourceProvider: providerEnum("source_provider"),
    sourceExternalId: varchar("source_external_id", { length: 255 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 64 }),
    /** Email normalizado (lowercase, trim) para deduplicação. */
    normalizedEmail: varchar("normalized_email", { length: 255 }),
    /** Telefone normalizado (dígitos/E.164) para deduplicação. */
    normalizedPhone: varchar("normalized_phone", { length: 64 }),
    name: varchar("name", { length: 255 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    funnelId: uuid("funnel_id").references(() => funnels.id, { onDelete: "set null" }),
    currentFunnelStepId: uuid("current_funnel_step_id").references(() => funnelSteps.id, {
      onDelete: "set null",
    }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true, precision: 6 }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, precision: 6 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    leads_tenant_status_idx: index("leads_tenant_status_idx").on(
      t.tenantId,
      t.status
    ),
    leads_tenant_first_seen_idx: index("leads_tenant_first_seen_idx").on(
      t.tenantId,
      t.firstSeenAt
    ),
    leads_funnel_step_idx: index("leads_funnel_step_idx").on(
      t.funnelId,
      t.currentFunnelStepId
    ),
    leads_email_idx: index("leads_email_idx").on(t.email),
    leads_phone_idx: index("leads_phone_idx").on(t.phone),
    leads_tenant_normalized_email_unique: uniqueIndex(
      "leads_tenant_normalized_email_unique"
    )
      .on(t.tenantId, t.normalizedEmail)
      .where(sql`${t.normalizedEmail} IS NOT NULL`),
    leads_tenant_normalized_phone_unique: uniqueIndex(
      "leads_tenant_normalized_phone_unique"
    )
      .on(t.tenantId, t.normalizedPhone)
      .where(sql`${t.normalizedPhone} IS NOT NULL`),
    leads_tenant_source_external_unique: uniqueIndex(
      "leads_tenant_source_external_unique"
    )
      .on(t.tenantId, t.sourceProvider, t.sourceExternalId)
      .where(sql`${t.sourceExternalId} IS NOT NULL`),
  })
);
