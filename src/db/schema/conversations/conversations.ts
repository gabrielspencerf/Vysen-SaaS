import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenants } from "../auth/tenants";
import { leads } from "../funnels-leads/leads";
import { evolutionInstances } from "../integrations/evolution-instances";
import { uazapiInstances } from "../integrations/uazapi-instances";
import { conversationStatusEnum } from "../../enums";
import { contacts } from "../contacts";

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    evolutionInstanceId: uuid("evolution_instance_id").references(
      () => evolutionInstances.id,
      { onDelete: "cascade" }
    ),
    uazapiInstanceId: uuid("uazapi_instance_id").references(
      () => uazapiInstances.id,
      { onDelete: "cascade" }
    ),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    status: conversationStatusEnum("status").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, precision: 6 }),
    startedAt: timestamp("started_at", { withTimezone: true, precision: 6 }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true, precision: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    conversations_tenant_lead_idx: index("conversations_tenant_lead_idx").on(
      t.tenantId,
      t.leadId
    ),
    conversations_tenant_status_idx: index(
      "conversations_tenant_status_idx"
    ).on(t.tenantId, t.status),
    conversations_tenant_started_idx: index(
      "conversations_tenant_started_idx"
    ).on(t.tenantId, t.startedAt),
  })
);
