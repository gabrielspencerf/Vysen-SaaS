import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenants } from "../auth/tenants";
import { users } from "../auth/users";

/**
 * Thread completa do copiloto Vysen, com mensagens armazenadas em JSONB
 * (estrutura `[{ role, text }]`). Mantém summary + contexts em colunas
 * dedicadas para sumarização. Refletindo o shape de `VysenChatThread` do
 * client.
 */
export const vysenChatThreads = pgTable(
  "vysen_chat_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    contextArea: varchar("context_area", { length: 64 }).notNull().default("geral"),
    summary: varchar("summary", { length: 512 }).notNull().default(""),
    contexts: jsonb("contexts").notNull().default("[]"),
    messages: jsonb("messages").notNull().default("[]"),
    messageCount: integer("message_count").notNull().default(0),
    experienceStarted: boolean("experience_started").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    vysen_chat_threads_user_idx: index("vysen_chat_threads_user_idx").on(
      t.tenantId,
      t.userId,
      t.updatedAt
    ),
  })
);
