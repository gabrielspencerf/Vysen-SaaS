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
import { uazapiInstances } from "../integrations/uazapi-instances";

/**
 * Eventos brutos de webhook UAZAPI; append-only (apenas processed_at/processing_error atualizáveis).
 * Paridade com evolution_webhook_events.
 */
export const uazapiWebhookEvents = pgTable(
  "uazapi_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    uazapiInstanceId: uuid("uazapi_instance_id")
      .notNull()
      .references(() => uazapiInstances.id, { onDelete: "cascade" }),
    externalEventId: varchar("external_event_id", { length: 255 }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true, precision: 6 }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, precision: 6 }),
    processingError: varchar("processing_error", { length: 1024 }),
  },
  (t) => ({
    uazapi_webhook_events_tenant_received_idx: index(
      "uazapi_webhook_events_tenant_received_idx"
    ).on(t.tenantId, t.receivedAt),
    uazapi_webhook_events_instance_received_idx: index(
      "uazapi_webhook_events_instance_received_idx"
    ).on(t.uazapiInstanceId, t.receivedAt),
    uazapi_webhook_events_processed_idx: index(
      "uazapi_webhook_events_processed_idx"
    ).on(t.processedAt),
    uazapi_webhook_events_dedup_unique: uniqueIndex(
      "uazapi_webhook_events_dedup_unique"
    )
      .on(t.tenantId, t.uazapiInstanceId, t.externalEventId)
      .where(sql`${t.externalEventId} IS NOT NULL`),
  })
);
