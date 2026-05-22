import {
  index,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenants } from "../auth/tenants";
import { leads } from "../funnels-leads/leads";
import { contacts } from "../contacts";
import { conversations } from "../conversations/conversations";
import { opportunityStageEnum } from "../../enums";

/**
 * Oportunidades: vínculo entre lead e/ou contato com uma conversa/negócio.
 * Um mesmo lead ou contato pode ter várias oportunidades (múltiplas conversas, reabordagens).
 * contact_started_at, contracted_model e job_value permitem ROAS/ROI.
 */
export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    /** Estágio do negócio (enum tipado em src/db/enums.ts → opportunity_stage_enum) */
    stage: opportunityStageEnum("stage").notNull().default("open"),
    title: varchar("title", { length: 255 }),
    /** Data de início do contato comercial */
    contactStartedAt: timestamp("contact_started_at", {
      withTimezone: true,
      precision: 6,
    }),
    /** Modelo/plano contratado (ex.: básico, premium) */
    contractedModel: varchar("contracted_model", { length: 128 }),
    /** Valor do trabalho em BRL (para ROAS/ROI) */
    jobValue: numeric("job_value", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    opportunities_tenant_idx: index("opportunities_tenant_idx").on(t.tenantId),
    opportunities_lead_idx: index("opportunities_lead_idx").on(t.leadId),
    opportunities_contact_idx: index("opportunities_contact_idx").on(t.contactId),
    opportunities_conversation_idx: index("opportunities_conversation_idx").on(
      t.conversationId
    ),
  })
);
