import {
  boolean,
  index,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenants } from "../auth/tenants";

/** Tipo de cobrança: pagamento único ou recorrente (para MRR) */
export const productBillingTypeEnum = ["one_time", "recurring"] as const;
/** Intervalo de cobrança (apenas para recorrente): mensal ou anual */
export const productBillingIntervalEnum = ["monthly", "yearly"] as const;

/**
 * Produtos (ou serviços) do tenant: valor de ticket, recorrente ou único, para MRR e relatórios.
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: varchar("description", { length: 512 }),
    /** Preço unitário; moeda em currency */
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("BRL"),
    /** one_time | recurring — recorrente entra no cálculo de MRR */
    billingType: varchar("billing_type", { length: 32 }).notNull().default("one_time"),
    /** monthly | yearly — só para billing_type = recurring; MRR = unit_price (monthly) ou unit_price/12 (yearly) */
    billingInterval: varchar("billing_interval", { length: 16 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, precision: 6 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => ({
    products_tenant_idx: index("products_tenant_idx").on(t.tenantId),
  })
);
