import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenants } from "../auth/tenants";
import { conversations } from "./conversations";

/**
 * Mensagens da conversa; append-only.
 * content_text = texto para exibição; payload = estrutura completa (mídia, metadados).
 */
export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 255 }),
    direction: varchar("direction", { length: 8 }).notNull(), // in | out
    /** True quando a mensagem foi enviada por agente/IA/BOT (não por humano). */
    sentByBot: boolean("sent_by_bot").notNull().default(false),
    contentType: varchar("content_type", { length: 64 }).notNull(),
    /** Texto para exibição (mensagem de texto, legenda). Null para mídia sem legenda. */
    contentText: text("content_text"),
    /** Estrutura completa do provedor (URLs, metadados); não duplicar texto já em content_text. */
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    sentAt: timestamp("sent_at", { withTimezone: true, precision: 6 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    conversation_messages_conversation_sent_idx: index(
      "conversation_messages_conversation_sent_idx"
    ).on(t.conversationId, t.sentAt),
    conversation_messages_tenant_sent_idx: index(
      "conversation_messages_tenant_sent_idx"
    ).on(t.tenantId, t.sentAt),
    conversation_messages_dedup_idx: uniqueIndex(
      "conversation_messages_dedup_idx"
    )
      .on(t.conversationId, t.externalId)
      .where(sql`external_id IS NOT NULL`),
  })
);
