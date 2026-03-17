-- PageSpeed: métricas por data e dispositivo (calendário / séries diárias)
ALTER TABLE "pagespeed_results"
  ADD COLUMN IF NOT EXISTS "metric_date" date;

-- Preencher metric_date a partir de fetched_at para registros existentes
UPDATE "pagespeed_results"
SET "metric_date" = ("fetched_at" AT TIME ZONE 'UTC')::date
WHERE "metric_date" IS NULL;

ALTER TABLE "pagespeed_results"
  ALTER COLUMN "metric_date" SET NOT NULL;

-- Remover duplicatas: manter apenas o registro mais recente (fetched_at) por (tenant, url, strategy, metric_date)
DELETE FROM "pagespeed_results" p
WHERE p.id NOT IN (
  SELECT DISTINCT ON (tenant_id, url, strategy, metric_date) id
  FROM "pagespeed_results"
  ORDER BY tenant_id, url, strategy, metric_date, fetched_at DESC
);

CREATE INDEX IF NOT EXISTS "pagespeed_results_tenant_date_strategy_idx"
  ON "pagespeed_results" USING btree ("tenant_id", "metric_date", "strategy");

-- Um snapshot por dia por URL por dispositivo (upsert no job)
CREATE UNIQUE INDEX IF NOT EXISTS "pagespeed_results_tenant_url_strategy_date_unique"
  ON "pagespeed_results" USING btree ("tenant_id", "url", "strategy", "metric_date");

-- Produtos: recorrente vs único para MRR
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "billing_type" varchar(32) NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS "billing_interval" varchar(16);

COMMENT ON COLUMN "products"."billing_type" IS 'one_time | recurring';
COMMENT ON COLUMN "products"."billing_interval" IS 'monthly | yearly; apenas para billing_type = recurring';
