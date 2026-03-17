import {
  date,
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenants } from "../auth/tenants";

/**
 * Histórico de resultados do PageSpeed Insights por data e dispositivo (mobile/desktop).
 * Uma linha por (tenant, url, strategy, metric_date) para calendário e métricas diárias.
 */
export const pagespeedResults = pgTable(
  "pagespeed_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    url: varchar("url", { length: 2048 }).notNull(),
    /** mobile | desktop (dispositivo) */
    strategy: varchar("strategy", { length: 16 }).notNull(),
    /** Data do snapshot (dia) para calendário e séries diárias */
    metricDate: date("metric_date").notNull(),
    /** Resposta da API (lighthouseResult, loadingExperience, scores, LCP, FCP, CLS, INP, etc.) */
    result: jsonb("result").$type<Record<string, unknown>>().notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, precision: 6 })
      .notNull(),
  },
  (t) => ({
    pagespeed_results_tenant_idx: index("pagespeed_results_tenant_idx").on(
      t.tenantId
    ),
    pagespeed_results_tenant_date_strategy_idx: index(
      "pagespeed_results_tenant_date_strategy_idx"
    ).on(t.tenantId, t.metricDate, t.strategy),
    pagespeed_results_tenant_url_strategy_date_unique: unique(
      "pagespeed_results_tenant_url_strategy_date_unique"
    ).on(t.tenantId, t.url, t.strategy, t.metricDate),
  })
);
